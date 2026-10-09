// CompiCode executor: an HTTP microservice that judges code submissions.
//
// A submission is compiled once, then run against every testcase in parallel,
// each run in its own process group with a wall-clock limit and capped output.
//
//   GET  /  or  /health   -> {"ok": true, "service": "CompiCode executor"}
//   POST /evaluate        -> body    {"code", "language", "test_cases": [{"input", "expected_output"}]}
//                            returns {"results": [{"input", "expected", "actual", "error",
//                                                  "success", "passed", "runtime_ms"}]}
//
// Languages: python (python3), cpp (g++ -O2), java (javac + java).
// Environment: PORT (default 7860), EXECUTOR_WORKERS (parallel runs per submission, default 2).

#include <httplib.h>
#include <nlohmann/json.hpp>

#include <fcntl.h>
#include <poll.h>
#include <sys/resource.h>
#include <sys/wait.h>
#include <unistd.h>

#include <algorithm>
#include <atomic>
#include <cctype>
#include <cerrno>
#include <chrono>
#include <csignal>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <optional>
#include <string>
#include <thread>
#include <vector>

namespace fs = std::filesystem;
using json = nlohmann::json;
using Clock = std::chrono::steady_clock;

namespace {

constexpr double kCompileTimeoutSec = 10.0;
constexpr size_t kMaxStdout = 8u << 20;   // 8 MiB per run
constexpr size_t kMaxStderr = 64u << 10;  // 64 KiB per run (the rest is dropped)
constexpr rlim_t kMaxFileBytes = 64u << 20;

int g_workers = 2;

// ---------------------------------------------------------------- processes

struct ProcessResult {
    std::string out, err;
    int exit_code = -1;    // valid when exited normally
    int term_signal = 0;   // non-zero when killed by a signal we did not send
    bool timed_out = false;
    bool output_limit = false;
    long runtime_ms = 0;
    std::string spawn_error;  // fork/pipe failure
};

void close_fd(int& fd) {
    if (fd >= 0) {
        close(fd);
        fd = -1;
    }
}

void set_nonblocking(int fd) { fcntl(fd, F_SETFL, fcntl(fd, F_GETFL) | O_NONBLOCK); }

// Runs argv in `cwd`, feeds it `input`, and collects stdout/stderr until it exits
// or `timeout_sec` passes. The child gets its own process group so a timeout
// kills everything it spawned.
ProcessResult run_process(const std::vector<std::string>& argv, const std::string& input,
                          double timeout_sec, const std::string& cwd) {
    ProcessResult r;
    int in[2] = {-1, -1}, out[2] = {-1, -1}, err[2] = {-1, -1};
    // O_CLOEXEC: a child forked by another request's thread must not inherit our pipes,
    // or we would never see EOF on them.
    if (pipe2(in, O_CLOEXEC) || pipe2(out, O_CLOEXEC) || pipe2(err, O_CLOEXEC)) {
        r.spawn_error = std::string("pipe: ") + std::strerror(errno);
        for (int* p : {in, out, err}) { close_fd(p[0]); close_fd(p[1]); }
        return r;
    }

    // Everything the child touches is prepared before fork(): no allocation after it.
    std::vector<char*> args;
    for (const auto& a : argv) args.push_back(const_cast<char*>(a.c_str()));
    args.push_back(nullptr);
    const char* dir = cwd.c_str();

    const auto start = Clock::now();
    const auto deadline = start + std::chrono::duration_cast<Clock::duration>(std::chrono::duration<double>(timeout_sec));
    pid_t pid = fork();
    if (pid < 0) {
        r.spawn_error = std::string("fork: ") + std::strerror(errno);
        for (int* p : {in, out, err}) { close_fd(p[0]); close_fd(p[1]); }
        return r;
    }
    if (pid == 0) {
        setpgid(0, 0);
        dup2(in[0], STDIN_FILENO);
        dup2(out[1], STDOUT_FILENO);
        dup2(err[1], STDERR_FILENO);
        rlimit no_core{0, 0};
        setrlimit(RLIMIT_CORE, &no_core);
        rlimit fsize{kMaxFileBytes, kMaxFileBytes};
        setrlimit(RLIMIT_FSIZE, &fsize);
        if (chdir(dir) == 0) execvp(args[0], args.data());
        const char msg[] = "executor: could not start the program\n";
        ssize_t ignored = write(STDERR_FILENO, msg, sizeof msg - 1);
        (void)ignored;
        _exit(127);
    }
    setpgid(pid, pid);  // also set from the parent, so kill(-pid) works immediately
    close_fd(in[0]);
    close_fd(out[1]);
    close_fd(err[1]);

    int to_child = in[1], from_out = out[0], from_err = err[0];
    set_nonblocking(to_child);
    set_nonblocking(from_out);
    set_nonblocking(from_err);
    size_t written = 0;
    if (input.empty()) close_fd(to_child);

    char buf[1 << 16];
    auto read_into = [&](int& fd) {
        const ssize_t k = read(fd, buf, sizeof buf);
        if (k > 0) {
            if (fd == from_out) {
                r.out.append(buf, static_cast<size_t>(k));
                if (r.out.size() > kMaxStdout) r.output_limit = true;
            } else if (r.err.size() < kMaxStderr) {
                r.err.append(buf, std::min(static_cast<size_t>(k), kMaxStderr - r.err.size()));
            }
        } else if (k == 0 || (errno != EAGAIN && errno != EINTR)) {
            close_fd(fd);
        }
        return k > 0;
    };

    int status = 0;
    bool reaped = false;
    while (from_out >= 0 || from_err >= 0) {
        const auto now = Clock::now();
        if (now >= deadline) {
            r.timed_out = true;
            break;
        }
        // Wake up regularly to notice a program that exited while something it
        // started in the background still holds the output pipes open.
        const int wait_ms = static_cast<int>(std::min<long long>(
            20, std::chrono::duration_cast<std::chrono::milliseconds>(deadline - now).count() + 1));

        pollfd fds[3];
        int n = 0;
        if (to_child >= 0) fds[n++] = {to_child, POLLOUT, 0};
        if (from_out >= 0) fds[n++] = {from_out, POLLIN, 0};
        if (from_err >= 0) fds[n++] = {from_err, POLLIN, 0};
        if (poll(fds, n, wait_ms) < 0) {
            if (errno == EINTR) continue;
            break;
        }
        for (int i = 0; i < n; ++i) {
            if (!fds[i].revents) continue;
            const int fd = fds[i].fd;
            if (fd == to_child) {
                const size_t chunk = std::min(input.size() - written, sizeof buf);
                const ssize_t w = write(to_child, input.data() + written, chunk);
                if (w > 0) {
                    written += static_cast<size_t>(w);
                    if (written == input.size()) close_fd(to_child);
                } else if (w < 0 && errno != EAGAIN && errno != EINTR) {
                    close_fd(to_child);  // EPIPE: the program stopped reading its input
                }
            } else {
                read_into(fd == from_out ? from_out : from_err);
            }
        }
        if (r.output_limit) break;
        if (waitpid(pid, &status, WNOHANG) == pid) {
            // Exited: whatever it wrote is already in the pipes, so drain that and stop.
            reaped = true;
            while (from_out >= 0 && !r.output_limit && read_into(from_out)) {}
            while (from_err >= 0 && read_into(from_err)) {}
            break;
        }
    }
    close_fd(to_child);
    close_fd(from_out);
    close_fd(from_err);

    // The pipes can close before the program exits; keep enforcing the deadline.
    bool killed = false;
    if (r.output_limit || (r.timed_out && !reaped)) {
        kill(-pid, SIGKILL);
        killed = true;
    }
    while (!reaped) {
        const pid_t w = waitpid(pid, &status, killed ? 0 : WNOHANG);
        if (w == pid) break;
        if (w < 0 && errno != EINTR) break;
        if (!killed && Clock::now() >= deadline) {
            r.timed_out = true;
            kill(-pid, SIGKILL);
            killed = true;
        } else if (!killed) {
            std::this_thread::sleep_for(std::chrono::milliseconds(2));
        }
    }
    kill(-pid, SIGKILL);  // sweep up anything the program left running in the background

    r.runtime_ms = static_cast<long>(
        std::chrono::duration_cast<std::chrono::milliseconds>(Clock::now() - start).count());
    if (WIFEXITED(status)) r.exit_code = WEXITSTATUS(status);
    else if (WIFSIGNALED(status) && !killed) r.term_signal = WTERMSIG(status);
    return r;
}

// ---------------------------------------------------------------- judging

struct RunOutcome {
    bool success = false;
    std::string stdout_text, stderr_text;
    long runtime_ms = 0;
};

std::string format_seconds(double s) {
    char text[32];
    std::snprintf(text, sizeof text, "%g", s);
    return text;
}

// Python's text mode turned \r\n and \r into \n; keep comparing the same way.
std::string normalize_newlines(const std::string& s) {
    std::string r;
    r.reserve(s.size());
    for (size_t i = 0; i < s.size(); ++i) {
        if (s[i] == '\r') {
            r.push_back('\n');
            if (i + 1 < s.size() && s[i + 1] == '\n') ++i;
        } else {
            r.push_back(s[i]);
        }
    }
    return r;
}

std::string trim(const std::string& s) {
    const char* ws = " \t\n\r\f\v";
    const size_t b = s.find_first_not_of(ws);
    if (b == std::string::npos) return "";
    return s.substr(b, s.find_last_not_of(ws) - b + 1);
}

std::string lower(std::string s) {
    std::transform(s.begin(), s.end(), s.begin(), [](unsigned char c) { return std::tolower(c); });
    return s;
}

bool is_ident(char c) { return std::isalnum(static_cast<unsigned char>(c)) || c == '_'; }

// Java needs the file named after the public class; fall back to the first class, then Main.
std::string java_class_name(const std::string& code) {
    std::string first;
    for (size_t pos = code.find("class"); pos != std::string::npos; pos = code.find("class", pos + 5)) {
        const size_t after = pos + 5;
        if ((pos > 0 && is_ident(code[pos - 1])) || after >= code.size() || !std::isspace(static_cast<unsigned char>(code[after]))) continue;
        size_t b = after;
        while (b < code.size() && std::isspace(static_cast<unsigned char>(code[b]))) ++b;
        size_t e = b;
        while (e < code.size() && is_ident(code[e])) ++e;
        if (e == b) continue;
        const std::string name = code.substr(b, e - b);
        if (first.empty()) first = name;

        // Walk back over the modifiers in front of `class`, looking for `public`.
        size_t p = pos;
        for (int words = 0; words < 3; ++words) {
            while (p > 0 && std::isspace(static_cast<unsigned char>(code[p - 1]))) --p;
            size_t q = p;
            while (q > 0 && is_ident(code[q - 1])) --q;
            const std::string word = code.substr(q, p - q);
            if (word == "public") return name;
            if (word != "final" && word != "abstract" && word != "static") break;
            p = q;
        }
    }
    return first.empty() ? "Main" : first;
}

bool write_file(const fs::path& path, const std::string& content) {
    std::ofstream f(path, std::ios::binary);
    f << content;
    return static_cast<bool>(f);
}

// Writes and compiles the submission. Returns the command that runs it, or sets `error`.
std::optional<std::vector<std::string>> prepare(const std::string& code, const std::string& lang,
                                                const fs::path& dir, std::string& error) {
    auto compile = [&](const std::vector<std::string>& cmd) {
        const ProcessResult c = run_process(cmd, "", kCompileTimeoutSec, dir.string());
        if (!c.spawn_error.empty()) error = c.spawn_error;
        else if (c.timed_out) error = "Compilation Timeout (over " + format_seconds(kCompileTimeoutSec) + " seconds)";
        else if (c.exit_code != 0) error = "Compilation Error:\n" + normalize_newlines(c.err);
        return error.empty();
    };

    if (lang == "python") {
        const fs::path src = dir / "main.py";
        if (!write_file(src, code)) { error = "Could not write the source file"; return std::nullopt; }
        return std::vector<std::string>{"python3", src.string()};
    }
    if (lang == "cpp") {
        const fs::path src = dir / "main.cpp", bin = dir / "main";
        if (!write_file(src, code)) { error = "Could not write the source file"; return std::nullopt; }
        if (!compile({"g++", "-O2", "-pipe", src.string(), "-o", bin.string()})) return std::nullopt;
        return std::vector<std::string>{bin.string()};
    }
    const std::string name = java_class_name(code);
    const fs::path src = dir / (name + ".java");
    if (!write_file(src, code)) { error = "Could not write the source file"; return std::nullopt; }
    if (!compile({"javac", "-encoding", "UTF-8", src.string()})) return std::nullopt;
    return std::vector<std::string>{"java", "-XX:+UseSerialGC", "-cp", dir.string(), name};
}

RunOutcome run_testcase(const std::vector<std::string>& cmd, const std::string& input, double timeout_sec,
                        const fs::path& dir) {
    const ProcessResult p = run_process(cmd, input, timeout_sec, dir.string());
    RunOutcome o;
    o.runtime_ms = p.runtime_ms;
    if (!p.spawn_error.empty()) {
        o.stderr_text = p.spawn_error;
        o.runtime_ms = 0;
    } else if (p.timed_out) {
        o.stderr_text = "Execution Timeout (over " + format_seconds(timeout_sec) + " seconds)";
        o.runtime_ms = static_cast<long>(timeout_sec * 1000);
    } else if (p.output_limit) {
        o.stderr_text = "Output Limit Exceeded (over " + std::to_string(kMaxStdout >> 20) + " MB)";
    } else {
        o.stdout_text = normalize_newlines(p.out);
        o.stderr_text = normalize_newlines(p.err);
        if (p.term_signal) {
            if (!o.stderr_text.empty() && o.stderr_text.back() != '\n') o.stderr_text += '\n';
            o.stderr_text += std::string("Runtime Error: ") + strsignal(p.term_signal) +
                             " (signal " + std::to_string(p.term_signal) + ")";
        }
        o.success = p.term_signal == 0 && p.exit_code == 0;
    }
    return o;
}

std::vector<RunOutcome> evaluate(const std::string& code, const std::string& language,
                                 const std::vector<std::string>& inputs) {
    std::vector<RunOutcome> results(inputs.size());
    if (inputs.empty()) return results;

    auto fail_all = [&](const std::string& message) {
        for (auto& r : results) r.stderr_text = message;
        return results;
    };

    std::string lang = lower(language);
    if (lang == "c++") lang = "cpp";
    if (lang != "python" && lang != "cpp" && lang != "java") return fail_all("Unsupported language: " + language);
    const double timeout_sec = lang == "java" ? 3.0 : 2.0;

    std::string tmpl = (fs::temp_directory_path() / "run_XXXXXX").string();
    if (!mkdtemp(tmpl.data())) return fail_all(std::string("mkdtemp: ") + std::strerror(errno));
    const fs::path dir = tmpl;

    std::string error;
    if (const auto cmd = prepare(code, lang, dir, error)) {
        std::atomic<size_t> next{0};
        auto worker = [&] {
            for (size_t i = next++; i < inputs.size(); i = next++) results[i] = run_testcase(*cmd, inputs[i], timeout_sec, dir);
        };
        std::vector<std::thread> pool;
        const size_t n = std::min(static_cast<size_t>(g_workers), inputs.size());
        for (size_t t = 1; t < n; ++t) pool.emplace_back(worker);
        worker();
        for (auto& t : pool) t.join();
    } else {
        fail_all(error);
    }

    std::error_code ignored;
    fs::remove_all(dir, ignored);
    return results;
}

// ---------------------------------------------------------------- HTTP

void send_json(httplib::Response& res, const json& body, int status = 200) {
    res.status = status;
    // Program output is arbitrary bytes; replace invalid UTF-8 instead of failing.
    res.set_content(body.dump(-1, ' ', false, json::error_handler_t::replace), "application/json");
}

void handle_evaluate(const httplib::Request& req, httplib::Response& res) {
    json body = json::parse(req.body, nullptr, false);
    if (body.is_discarded() || !body.is_object()) return send_json(res, {{"detail", "Body must be a JSON object"}}, 422);
    if (!body.contains("code") || !body["code"].is_string() || !body.contains("language") ||
        !body["language"].is_string() || !body.contains("test_cases") || !body["test_cases"].is_array())
        return send_json(res, {{"detail", "Expected string 'code', string 'language' and array 'test_cases'"}}, 422);

    std::vector<std::string> inputs, expected;
    for (const auto& tc : body["test_cases"]) {
        if (!tc.is_object() || !tc.contains("input") || !tc["input"].is_string() ||
            !tc.contains("expected_output") || !tc["expected_output"].is_string())
            return send_json(res, {{"detail", "Each testcase needs string 'input' and 'expected_output'"}}, 422);
        inputs.push_back(tc["input"].get<std::string>());
        expected.push_back(tc["expected_output"].get<std::string>());
    }

    const std::string code = body["code"].get<std::string>();
    const std::string language = body["language"].get<std::string>();
    const auto start = Clock::now();
    const std::vector<RunOutcome> runs = evaluate(code, language, inputs);

    json results = json::array();
    int passed_count = 0;
    for (size_t i = 0; i < runs.size(); ++i) {
        const RunOutcome& r = runs[i];
        const bool passed = r.success && trim(r.stdout_text) == trim(normalize_newlines(expected[i]));
        passed_count += passed;
        results.push_back({{"input", inputs[i]},
                           {"expected", expected[i]},
                           {"actual", r.stdout_text},
                           {"error", r.stderr_text},
                           {"success", r.success},
                           {"passed", passed},
                           {"runtime_ms", r.runtime_ms}});
    }
    const long ms = static_cast<long>(std::chrono::duration_cast<std::chrono::milliseconds>(Clock::now() - start).count());
    std::printf("[evaluate] %s: %d/%zu passed in %ld ms\n", language.c_str(), passed_count, runs.size(), ms);
    std::fflush(stdout);
    send_json(res, {{"results", results}});
}

}  // namespace

int main() {
    std::signal(SIGPIPE, SIG_IGN);  // writing to a program that exited must not kill the server
    if (const char* w = std::getenv("EXECUTOR_WORKERS")) g_workers = std::max(1, std::atoi(w));
    const char* port_env = std::getenv("PORT");
    const int port = port_env ? std::atoi(port_env) : 7860;

    httplib::Server server;
    server.set_payload_max_length(16u << 20);
    auto health = [](const httplib::Request&, httplib::Response& res) {
        send_json(res, {{"ok", true}, {"service", "CompiCode executor"}});
    };
    server.Get("/", health);
    server.Get("/health", health);
    server.Post("/evaluate", handle_evaluate);

    std::printf("CompiCode executor listening on 0.0.0.0:%d (%d parallel runs per submission)\n", port, g_workers);
    std::fflush(stdout);
    if (!server.listen("0.0.0.0", port)) {
        std::fprintf(stderr, "could not listen on port %d\n", port);
        return 1;
    }
}

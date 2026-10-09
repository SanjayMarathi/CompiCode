---
title: Compicode Executor
emoji: 🏃
colorFrom: indigo
colorTo: gray
sdk: docker
pinned: false
license: mit
---

# CompiCode executor

The code-judging microservice behind [CompiCode](https://github.com/SanjayMarathi/CompiCode), written in C++17. It runs as its own Hugging Face Space; the CompiCode API sends it submissions over HTTP and gets per-testcase verdicts back.

## API

| Method | Route | Description |
|---|---|---|
| `GET` | `/` or `/health` | `{"ok": true, "service": "CompiCode executor"}`. CompiCode pings this to wake the Space and keep it awake. |
| `POST` | `/evaluate` | Judge a submission (see below). Malformed bodies get `422`. |

```json
POST /evaluate
{
  "code": "print(int(input()) * 2)",
  "language": "python",
  "test_cases": [{ "input": "4", "expected_output": "8" }]
}
```

```json
{
  "results": [
    { "input": "4", "expected": "8", "actual": "8\n", "error": "",
      "success": true, "passed": true, "runtime_ms": 60 }
  ]
}
```

`passed` means the program exited cleanly and its output matches the expected output, ignoring leading and trailing whitespace and `\r\n` versus `\n` line endings.

## How a submission is judged

1. The source is written to a fresh temporary directory and **compiled once**: `g++ -O2` for C++, `javac` for Java (the file is named after the public class). Python is not compiled. The compile limit is 10 s.
2. The program runs against **every testcase in parallel** (`EXECUTOR_WORKERS` at a time, default 2, matching the Space's 2 vCPUs so busy programs don't slow each other into false timeouts).
3. Each run is a separate process in its own **process group**. The server feeds stdin and reads stdout/stderr through non-blocking pipes with `poll()`, so large inputs and outputs can't deadlock it.
4. Limits per run: **2 s** wall clock (Java **3 s**), **8 MB** of output, 64 KB of stderr kept, 64 MB per written file, no core dumps. Over the time or output limit, the whole process group is killed. Anything a program leaves running in the background is killed when it exits.
5. A crash such as a segfault is reported as `Runtime Error: Segmentation fault (signal 11)`.
6. The temporary directory is deleted.

The image precompiles `<bits/stdc++.h>` with the judge's flags, so competitive-programming C++ that includes it compiles several times faster. [`tini`](https://github.com/krallin/tini) runs as PID 1 and reaps leftover processes.

## Stack

- C++17, built with g++ 14 on Debian trixie
- [cpp-httplib](https://github.com/yhirose/cpp-httplib) for HTTP and [nlohmann/json](https://github.com/nlohmann/json) for JSON, both from Debian packages
- POSIX `fork`/`execvp`, `pipe2`, `poll`, `waitpid` and `setrlimit` for running programs
- Runtimes judged: g++ 14 (C++), OpenJDK 21 (Java), Python 3.13

## Run it locally

```bash
docker build -t compicode-executor .
docker run --rm -p 7860:7860 compicode-executor
curl -s localhost:7860/evaluate -H 'Content-Type: application/json' \
  -d '{"code":"print(input())","language":"python","test_cases":[{"input":"hi","expected_output":"hi"}]}'
```

## Deploying

This folder is the whole Space. Copy `server.cpp`, `Dockerfile` and this `README.md` into the `compicode-executor` Space repository and push; Hugging Face rebuilds the image.

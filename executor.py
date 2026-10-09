"""Compile a submission once, then run it against every testcase in parallel."""
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from typing import List, Optional, Tuple

COMPILE_TIMEOUT = 10.0
RUN_TIMEOUT = {"python": 2.0, "cpp": 2.0, "java": 3.0}
# Testcases run side by side. Keep this at the number of CPUs the Space really
# has (2 on cpu-basic), or busy programs slow each other into false timeouts.
WORKERS = max(1, int(os.getenv("EXECUTOR_WORKERS", "2")))

LANGUAGES = {"python": "python", "cpp": "cpp", "c++": "cpp", "java": "java"}


def _write(path: str, code: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        f.write(code)


def _compile(cmd: List[str]) -> Optional[str]:
    """Run a compiler. Returns the error message, or None on success."""
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=COMPILE_TIMEOUT)
    except subprocess.TimeoutExpired:
        return f"Compilation Timeout (over {COMPILE_TIMEOUT:g} seconds)"
    return None if proc.returncode == 0 else f"Compilation Error:\n{proc.stderr}"


def _java_class(code: str) -> str:
    # The file must be named after the public class; fall back to the first class.
    match = re.search(r"public\s+(?:final\s+)?class\s+([A-Za-z0-9_]+)", code) or re.search(r"class\s+([A-Za-z0-9_]+)", code)
    return match.group(1) if match else "Main"


def _prepare(code: str, lang: str, workdir: str) -> Tuple[Optional[List[str]], Optional[str]]:
    """Write (and compile) the source. Returns (run command, error)."""
    if lang == "python":
        path = os.path.join(workdir, "main.py")
        _write(path, code)
        return [sys.executable, path], None

    if lang == "cpp":
        source = os.path.join(workdir, "main.cpp")
        binary = os.path.join(workdir, "main")
        _write(source, code)
        error = _compile(["g++", "-O2", "-pipe", source, "-o", binary])
        return (None, error) if error else ([binary], None)

    name = _java_class(code)
    source = os.path.join(workdir, f"{name}.java")
    _write(source, code)
    error = _compile(["javac", "-encoding", "UTF-8", source])
    return (None, error) if error else (["java", "-XX:+UseSerialGC", "-cp", workdir, name], None)


def _run(cmd: List[str], input_str: str, timeout: float, workdir: str) -> dict:
    start = time.perf_counter()
    try:
        proc = subprocess.run(cmd, input=input_str, text=True, capture_output=True, timeout=timeout, cwd=workdir)
    except subprocess.TimeoutExpired:
        return {"success": False, "stdout": "", "stderr": f"Execution Timeout (over {timeout:g} seconds)", "runtime_ms": int(timeout * 1000)}
    except Exception as e:
        return {"success": False, "stdout": "", "stderr": str(e), "runtime_ms": 0}
    return {
        "success": proc.returncode == 0,
        "stdout": proc.stdout,
        "stderr": proc.stderr,
        "runtime_ms": int((time.perf_counter() - start) * 1000),
    }


def evaluate(code: str, language: str, inputs: List[str]) -> List[dict]:
    """One result per input, in order."""
    if not inputs:
        return []
    lang = LANGUAGES.get(language.lower())
    if lang is None:
        return [{"success": False, "stdout": "", "stderr": f"Unsupported language: {language}", "runtime_ms": 0} for _ in inputs]

    workdir = tempfile.mkdtemp(prefix="run_")
    try:
        try:
            cmd, error = _prepare(code, lang, workdir)
        except Exception as e:
            cmd, error = None, str(e)
        if error is not None:
            return [{"success": False, "stdout": "", "stderr": error, "runtime_ms": 0} for _ in inputs]

        timeout = RUN_TIMEOUT[lang]
        with ThreadPoolExecutor(max_workers=min(WORKERS, len(inputs))) as pool:
            return list(pool.map(lambda inp: _run(cmd, inp, timeout, workdir), inputs))
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


def execute_code(code: str, language: str, input_str: str) -> dict:
    """Single-input entry point, used by the WebSocket endpoint."""
    return evaluate(code, language, [input_str])[0]

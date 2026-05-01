import tempfile
import subprocess
import os
import time
import re

def execute_python(code: str, input_str: str) -> dict:
    start_time = time.time()
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(code)
            temp_path = f.name
        
        # Using subprocess.run with timeout
        process = subprocess.run(
            ['python', temp_path],
            input=input_str,
            text=True,
            capture_output=True,
            timeout=2.0
        )
        runtime_ms = (time.time() - start_time) * 1000
        
        return {
            "success": process.returncode == 0,
            "stdout": process.stdout,
            "stderr": process.stderr,
            "runtime_ms": int(runtime_ms)
        }
        
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "stdout": "",
            "stderr": "Execution Timeout (Over 2 seconds)",
            "runtime_ms": int((time.time() - start_time) * 1000)
        }
    except Exception as e:
        return {
            "success": False,
            "stdout": "",
            "stderr": str(e),
            "runtime_ms": 0
        }
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass


def execute_cpp(code: str, input_str: str) -> dict:
    start_time = time.time()
    temp_dir = tempfile.mkdtemp()
    source_path = os.path.join(temp_dir, 'main.cpp')
    binary_path = os.path.join(temp_dir, 'main.exe' if os.name == 'nt' else 'main')
    
    try:
        with open(source_path, 'w') as f:
            f.write(code)
        
        # Compile
        compile_proc = subprocess.run(
            ['g++', '-O2', source_path, '-o', binary_path],
            capture_output=True,
            text=True,
            timeout=5.0
        )
        
        if compile_proc.returncode != 0:
            return {
                "success": False,
                "stdout": "",
                "stderr": f"Compilation Error:\n{compile_proc.stderr}",
                "runtime_ms": int((time.time() - start_time) * 1000)
            }
            
        exec_start = time.time()
        # Execute
        process = subprocess.run(
            [binary_path],
            input=input_str,
            text=True,
            capture_output=True,
            timeout=2.0
        )
        runtime_ms = (time.time() - exec_start) * 1000
        
        return {
            "success": process.returncode == 0,
            "stdout": process.stdout,
            "stderr": process.stderr,
            "runtime_ms": int(runtime_ms)
        }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "stdout": "",
            "stderr": "Execution Timeout",
            "runtime_ms": int((time.time() - start_time) * 1000)
        }
    except Exception as e:
        return {
            "success": False,
            "stdout": "",
            "stderr": str(e),
            "runtime_ms": 0
        }
    finally:
        if os.path.exists(source_path):
            try:
                os.remove(source_path)
            except OSError:
                pass
        if os.path.exists(binary_path):
            try:
                os.remove(binary_path)
            except OSError:
                pass
        if os.path.exists(temp_dir):
            try:
                os.rmdir(temp_dir)
            except OSError:
                pass


def execute_java(code: str, input_str: str) -> dict:
    start_time = time.time()
    temp_dir = tempfile.mkdtemp()
    
    # Java single-file compilation requires the file to match the public class name
    class_match = re.search(r'class\s+([A-Za-z0-9_]+)', code)
    class_name = class_match.group(1) if class_match else "Main"
    source_path = os.path.join(temp_dir, f"{class_name}.java")
    
    try:
        with open(source_path, 'w') as f:
            f.write(code)
            
        # Compile
        compile_proc = subprocess.run(
            ['javac', source_path],
            capture_output=True, text=True, timeout=5.0
        )
        
        if compile_proc.returncode != 0:
            return {
                "success": False,
                "stdout": "",
                "stderr": f"Compilation Error:\n{compile_proc.stderr}",
                "runtime_ms": int((time.time() - start_time) * 1000)
            }
            
        exec_start = time.time()
        # Execute
        process = subprocess.run(
            ['java', '-cp', temp_dir, class_name],
            input=input_str,
            text=True,
            capture_output=True,
            timeout=3.0
        )
        runtime_ms = (time.time() - exec_start) * 1000
        
        return {
            "success": process.returncode == 0,
            "stdout": process.stdout,
            "stderr": process.stderr,
            "runtime_ms": int(runtime_ms)
        }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "stdout": "",
            "stderr": "Execution Timeout",
            "runtime_ms": int((time.time() - start_time) * 1000)
        }
    except Exception as e:
        return {
            "success": False,
            "stdout": "",
            "stderr": str(e),
            "runtime_ms": 0
        }
    finally:
        if os.path.exists(source_path):
            try:
                os.remove(source_path)
            except OSError:
                pass
        class_file = os.path.join(temp_dir, f"{class_name}.class")
        if os.path.exists(class_file):
            try:
                os.remove(class_file)
            except OSError:
                pass
        if os.path.exists(temp_dir):
            try:
                os.rmdir(temp_dir)
            except OSError:
                pass


def execute_code(code: str, language: str, input_str: str) -> dict:
    if language.lower() == 'python':
        return execute_python(code, input_str)
    elif language.lower() in ['cpp', 'c++']:
        return execute_cpp(code, input_str)
    elif language.lower() == 'java':
        return execute_java(code, input_str)
    else:
        return {
            "success": False, 
            "stdout": "", 
            "stderr": f"Unsupported language: {language}", 
            "runtime_ms": 0
        }

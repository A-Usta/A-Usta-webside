"""A-USTA V3.5.5: offline Windows clipboard-to-runner key validator.

Usage: python tools/v355/check_runner_key.py "C:\\path\\to\\runner.py"
Copy the A-USTA-TEST publishable key in Supabase immediately before running.
Never pass keys as command-line arguments or save them in files.
"""
import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

def emit(result, reason):
    print(json.dumps({
        "mode": "OFFLINE_CLIPBOARD_RUNNER_VALIDATION",
        "result": result,
        "reason": reason,
        "network_requests": 0,
        "storage_writes": 0,
        "credentials_printed": False,
    }))
    return 0 if result == "PASS" else 2

def main():
    if os.name != "nt":
        return emit("BLOCKED", "WINDOWS_REQUIRED")
    if len(sys.argv) != 2:
        return emit("BLOCKED", "RUNNER_PATH_REQUIRED")
    path = Path(sys.argv[1]).resolve()
    if path.name != "runner.py" or not path.is_file():
        return emit("BLOCKED", "RUNNER_NOT_FOUND")
    # Clipboard data is returned only to this process; no shell interpolation.
    try:
        p = subprocess.run(
            ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command",
             "Get-Clipboard -Raw"],
            capture_output=True, text=True, timeout=10, check=True,
        )
        key = p.stdout.rstrip("\r\n")
        if not key or "\n" in key or "\r" in key:
            return emit("BLOCKED", "CLIPBOARD_NOT_SINGLE_KEY")
        # Avoid executing arbitrary untrusted Python: only use a runner from
        # the explicitly supplied local package, reviewed by the operator.
        spec = importlib.util.spec_from_file_location("austa_test_runner", path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        try:
            module.validate_key(key)
        except module.Blocked:
            return emit("BLOCKED", "REJECTED_BY_RUNNER_VALIDATOR")
        if not key.startswith("sb_publishable_"):
            return emit("BLOCKED", "NOT_PUBLISHABLE_KEY")
        return emit("PASS", "ACCEPTED_BY_RUNNER_VALIDATOR")
    except (OSError, subprocess.SubprocessError, ImportError, AttributeError):
        return emit("BLOCKED", "LOCAL_DIAGNOSTIC_FAILURE")
    finally:
        if "key" in locals():
            key = None

if __name__ == "__main__":
    sys.exit(main())

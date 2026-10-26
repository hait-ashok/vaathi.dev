"""
Local sandbox runner for vaathi.dev Stage 2.

Start:
  cd sandbox
  source .venv/bin/activate
  python runner.py

The runner listens on http://127.0.0.1:8321 and executes Python code
from the sandbox page. It only runs locally — production will use
Lambda behind the same POST /run interface.
"""

import json
import os
import signal
import subprocess
import sys
import tempfile
import textwrap

from flask import Flask, Response, jsonify, request, stream_with_context
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins=["http://127.0.0.1:4321", "http://localhost:4321"])

VENV_PYTHON = os.path.join(os.path.dirname(__file__), ".venv", "bin", "python")
TIMEOUT_SECONDS = 60


@app.post("/run")
def run_code():
    body = request.get_json(silent=True) or {}
    code = body.get("code", "")
    env_vars = body.get("env", {})

    if not code.strip():
        return jsonify({"error": "No code provided."}), 400

    if len(code) > 20_000:
        return jsonify({"error": "Code is too long (20 000 char limit)."}), 400

    run_env = {
        **os.environ,
        "PYTHONUNBUFFERED": "1",
        "PYTHONDONTWRITEBYTECODE": "1",
    }
    for key, value in env_vars.items():
        if isinstance(key, str) and isinstance(value, str) and key.startswith("OPENAI"):
            run_env[key] = value

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".py", delete=False, dir=tempfile.gettempdir()
    ) as tmp:
        tmp.write(code)
        tmp_path = tmp.name

    def generate():
        proc = None
        try:
            proc = subprocess.Popen(
                [VENV_PYTHON, "-u", tmp_path],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                env=run_env,
                cwd=tempfile.gettempdir(),
            )
            while True:
                line = proc.stdout.readline()
                if not line and proc.poll() is not None:
                    break
                if line:
                    yield line.decode("utf-8", errors="replace")
            rc = proc.wait(timeout=5)
            yield f"\n--- exit {rc} ---\n"
        except subprocess.TimeoutExpired:
            if proc:
                proc.kill()
            yield "\n--- killed: timeout ---\n"
        except Exception as exc:
            yield f"\n--- error: {exc} ---\n"
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    def guarded():
        pid = None
        gen = generate()
        import threading

        result_lines = []
        done = threading.Event()

        def reader():
            for line in gen:
                result_lines.append(line)
            done.set()

        t = threading.Thread(target=reader, daemon=True)
        t.start()
        t.join(timeout=TIMEOUT_SECONDS)

        for line in result_lines:
            yield line

        if not done.is_set():
            yield "\n--- killed: global timeout ---\n"

    return Response(
        stream_with_context(guarded()),
        mimetype="text/plain; charset=utf-8",
        headers={"X-Content-Type-Options": "nosniff"},
    )


@app.get("/health")
def health():
    return jsonify({"ok": True, "python": sys.version})


if __name__ == "__main__":
    print(f"Sandbox runner on http://127.0.0.1:8321  (Python {sys.version})")
    print("Press Ctrl-C to stop.\n")
    app.run(host="127.0.0.1", port=8321, debug=False)

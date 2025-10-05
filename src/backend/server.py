import os
import json
import asyncio
import urllib.parse
from http.server import SimpleHTTPRequestHandler, HTTPServer
from typing import Optional

from agents import Agent, Runner, SQLiteSession
from backend.agents.study_planner import build_agent as build_planner
from backend.agents.concepts_helper import build_agent as build_helper


PUBLIC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "public")


def get_agent_by_id(agent_id: str) -> Agent:
    if agent_id == "helper":
        return build_helper()
    # default
    return build_planner()


async def run_agent(session: SQLiteSession, user_input: str, agent_id: str) -> str:
    agent = get_agent_by_id(agent_id)
    result = await Runner.run(agent, user_input, session=session)
    return result.final_output


class ChatHandler(SimpleHTTPRequestHandler):
    def do_GET(self) -> None:  # type: ignore[override]
        if self.path == "/" or self.path.startswith("/index.html"):
            self._serve_public("index.html")
            return

        # Serve arquivos estáticos de /public
        safe_path = self.path.lstrip("/")
        self._serve_public(safe_path)

    def do_POST(self) -> None:  # type: ignore[override]
        if self.path.startswith("/api/chat"):
            self._handle_chat()
            return

        self.send_response(404)
        self.end_headers()

    def _serve_public(self, filename: str) -> None:
        target = os.path.join(PUBLIC_DIR, filename)
        if not os.path.abspath(target).startswith(os.path.abspath(PUBLIC_DIR)):
            self.send_response(403)
            self.end_headers()
            return

        if not os.path.exists(target) or not os.path.isfile(target):
            self.send_response(404)
            self.end_headers()
            return

        self.send_response(200)
        if target.endswith(".html"):
            self.send_header("Content-Type", "text/html; charset=utf-8")
        elif target.endswith(".js"):
            self.send_header("Content-Type", "application/javascript; charset=utf-8")
        elif target.endswith(".css"):
            self.send_header("Content-Type", "text/css; charset=utf-8")
        else:
            self.send_header("Content-Type", "application/octet-stream")
        self.end_headers()
        with open(target, "rb") as f:
            self.wfile.write(f.read())

    def _handle_chat(self) -> None:
        content_length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(content_length) if content_length > 0 else b"{}"
        try:
            payload = json.loads(raw.decode("utf-8"))
        except Exception:
            payload = {}

        user_message: str = payload.get("message") or ""
        session_id: str = payload.get("sessionId") or "default"
        agent_id: str = payload.get("agentId") or "planner"

        if not user_message:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "message é obrigatório"}).encode("utf-8"))
            return

        if not os.getenv("OPENAI_API_KEY"):
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "OPENAI_API_KEY não definido"}).encode("utf-8"))
            return

        session = SQLiteSession(f"mentor_session_{session_id}")

        try:
            reply = asyncio.run(run_agent(session, user_message, agent_id))
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
            return

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"reply": reply}).encode("utf-8"))


def run(host: str = "127.0.0.1", port: int = 8000) -> None:
    if not os.path.isdir(PUBLIC_DIR):
        os.makedirs(PUBLIC_DIR, exist_ok=True)

    httpd = HTTPServer((host, port), ChatHandler)
    print(f"Servidor rodando em http://{host}:{port}")
    httpd.serve_forever()


if __name__ == "__main__":
    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError("Defina OPENAI_API_KEY antes de iniciar o servidor.")
    run()



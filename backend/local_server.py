"""Small standard-library HTTP server for local frontend integration."""

from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

from app import lambda_handler


class ApiRequestHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        self._dispatch()

    def do_POST(self) -> None:
        self._dispatch()

    def do_OPTIONS(self) -> None:
        self._dispatch()

    def _dispatch(self) -> None:
        parsed = urlsplit(self.path)
        query = {key: values[-1] for key, values in parse_qs(parsed.query).items()}
        body = None
        if self.command == "POST":
            try:
                content_length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                content_length = 0
            if content_length > 65536:
                self._send(413, {"error": {"code": "BODY_TOO_LARGE", "message": "El cuerpo supera el límite de 64 KB."}})
                return
            raw_body = self.rfile.read(content_length).decode("utf-8") if content_length else ""
            body = raw_body

        request_headers = {}
        origin = self.headers.get("Origin")
        if origin:
            request_headers["origin"] = origin

        event = {
            "version": "2.0",
            "rawPath": parsed.path,
            "queryStringParameters": query,
            "headers": request_headers,
            "requestContext": {"http": {"method": self.command, "path": parsed.path}},
            "body": body,
        }
        response = lambda_handler(event, None)
        response_body = response.get("body", "")
        try:
            payload = json.loads(response_body) if response_body else None
        except json.JSONDecodeError:
            payload = {"error": {"code": "INTERNAL_ERROR", "message": "Respuesta inválida del backend."}}
        self._send(response["statusCode"], payload, response.get("headers", {}))

    def _send(self, status: int, payload: object, headers: dict[str, str] | None = None) -> None:
        body = b"" if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        if "Content-Type" not in (headers or {}):
            self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if body:
            self.wfile.write(body)

    def log_message(self, format_string: str, *args: object) -> None:
        # Keep local logs limited to method, path, and status; never print request bodies.
        super().log_message(format_string, *args)


def main() -> None:
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer((host, port), ApiRequestHandler)
    print(f"FarmaSeñal API escuchando en http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

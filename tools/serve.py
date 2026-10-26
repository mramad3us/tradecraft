#!/usr/bin/env python3
# TRADECRAFT: a static file server for the game, on localhost only.
#
#   python3 tools/serve.py <port> [dir]
#
# No caching: the game is plain ES modules, and a browser that keeps some old
# modules and fetches some new ones after an update fails to load at all (an
# import of an export the cached file doesn't have). A deep listen queue: a
# load asks for dozens of modules at once, and with the standard library's
# queue of 5 the odd connection is reset (longhaul: about one load in thirty),
# a module never arrives and the game never starts. Bound to 127.0.0.1, not
# every interface: nothing on the network needs to see the working tree. File
# types are set here, not taken from the system (Windows' registry can call .js
# plain text). Runs the same on macOS and Windows (play.sh, play.cmd).
import sys
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler


class NoCache(SimpleHTTPRequestHandler):
    # Types by extension, not from the system: on Windows the registry can map .js to text/plain,
    # and a browser won't run a module served as text.
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript", ".mjs": "text/javascript",
                      ".json": "application/json", ".css": "text/css", ".html": "text/html", ".svg": "image/svg+xml",
                      ".png": "image/png", ".wasm": "application/wasm", ".txt": "text/plain"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass


class Server(ThreadingHTTPServer):
    request_queue_size = 128


port = int(sys.argv[1])
root = sys.argv[2] if len(sys.argv) > 2 else "."
Server(("127.0.0.1", port), partial(NoCache, directory=root)).serve_forever()

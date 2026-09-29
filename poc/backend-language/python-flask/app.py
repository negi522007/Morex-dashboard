"""POC — the same /about.json contract as the real NestJS backend, in Python/Flask.

Tests exactly what the decision matrix in ARCHITECTURE.md scored for "Node.js" vs "Python":
declaring a typed route, shaping a nested JSON response, and reading the caller's IP —
the three things every ServiceProvider/about.json call in the real app needs.

Run: ./.venv/bin/python app.py, then curl http://localhost:5001/about.json
"""

import time
from flask import Flask, jsonify, request

app = Flask(__name__)

# Same shape as backend/src/services/service-provider.interface.ts's WidgetParam —
# a plain dict here, no compile-time check that "type" only ever is "integer"/"string".
# In TypeScript this is `type WidgetParamType = 'integer' | 'string'`: a Python dict has
# no such guarantee without a separate runtime validator (pydantic, marshmallow, ...).
SERVICES = [
    {
        "name": "rss",
        "widgets": [
            {
                "name": "article_list",
                "description": "Display the last items from a given feed",
                "params": [
                    {"name": "link", "type": "string"},
                    {"name": "number", "type": "integer"},
                ],
            }
        ],
    }
]


@app.get("/about.json")
def about():
    return jsonify(
        {
            "client": {"host": request.remote_addr},
            "server": {
                "current_time": int(time.time()),
                "services": SERVICES,
            },
        }
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)

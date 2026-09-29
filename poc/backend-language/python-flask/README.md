# POC — Python (Flask) vs Node.js (NestJS)

What this tests: the same `/about.json` contract the real server exposes at
`backend/src/about/about.service.ts` — a typed route, a nested JSON shape, reading the
caller's IP — built in Python instead, to check the "Node.js" vs "Python" row of the
decision matrix in [ARCHITECTURE.md](../../../ARCHITECTURE.md) against something real,
not just a table of opinions.

## Run it

```bash
cd poc/backend-language/python-flask
python3 -m venv .venv
./.venv/bin/pip install flask
./.venv/bin/python app.py
# in another shell:
curl http://localhost:5001/about.json
```

Verified output:
```json
{"client":{"host":"127.0.0.1"},"server":{"current_time":1790637290,"services":[{"name":"rss","widgets":[{"description":"Display the last items from a given feed","name":"article_list","params":[{"name":"link","type":"string"},{"name":"number","type":"integer"}]}]}]}}
```

## What it confirmed

- **Getting to a working JSON endpoint is just as fast in Flask** — `app.py` is 45 lines,
  comparable to `about.service.ts` + its controller. This POC alone doesn't justify Node
  over Python; the real deciding factors are the ones below, only visible once you go past
  "hello world."
- **No compile-time contract.** `SERVICES` is a plain Python `dict`/`list` — nothing stops
  a typo like `"type": "int"` (should be `"integer"`) from shipping; it would only be
  caught by a human reading the JSON, or a runtime validator you'd have to add and
  maintain yourself (`pydantic`, `marshmallow`...). The real project's
  `WidgetParamType = 'integer' | 'string'` (in `service-provider.interface.ts`) makes that
  exact mistake a compile error, in every one of the 10 services, for free — this is the
  single biggest reason TypeScript end-to-end was chosen: the `ServiceProvider` contract
  (name, `requiresAuth`, `widgets[]`, each `fetchData`) is enforced by the compiler, not by
  code review discipline.
- **Flask says it itself**: running `app.py` prints *"WARNING: This is a development
  server. Do not use it in a production deployment. Use a production WSGI server
  instead."* — an extra moving part (gunicorn/uWSGI + likely nginx in front) the Node
  side doesn't need: NestJS's default adapter is already what you'd point Docker at.
- **Team experience**: Exauce had already built NestJS/Prisma projects before this one;
  neither of us had shipped a Flask/FastAPI backend. On a fixed deadline, "the language we
  already knew how to structure and debug" outweighed a difference this small.

## Conclusion

Confirms the matrix's own reasoning in ARCHITECTURE.md, doesn't overturn it: Python is a
completely viable choice and this POC works, but the typed contract across every
service/widget (the actual backbone of this app: `about.json`, the timer, widget config
validation, secret masking all trust the same `WidgetParam` types) and prior team
experience are what tipped it to Node.js/NestJS.

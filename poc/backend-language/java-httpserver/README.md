# POC — Java vs Node.js (NestJS)

What this tests: the "Node.js" vs "Java" row of the decision matrix in
[ARCHITECTURE.md](../../../ARCHITECTURE.md) — the same `/about.json` contract, built with
nothing but the JDK itself (`com.sun.net.httpserver`, zero external dependencies, zero
build tool — Java 11+'s single-file source launch runs `Main.java` directly).

## Run it

```bash
docker run --rm -d --name java-poc -p 5002:5002 \
  -v "$(pwd)/poc/backend-language/java-httpserver:/app" -w /app \
  eclipse-temurin:21-jdk java Main.java
curl http://localhost:5002/about.json
docker rm -f java-poc
```

Verified output:
```json
{"client":{"host":"172.17.0.1"},"server":{"current_time":1790638972,"services":[{"name":"rss","widgets":[{"name":"article_list","description":"Display the last items from a given feed","params":[{"name":"link","type":"string"},{"name":"number","type":"integer"}]}]}]}}
```

## What it confirmed

- **No JSON library in the JDK.** `Main.java` builds the response by hand-concatenating a
  string — a real Java service would add Jackson or Gson immediately, itself a dependency
  (and a Maven/Gradle project to manage it) the Node side never needs: `JSON.stringify`
  is a language builtin, and NestJS's `@Body()`/return-value pipeline serializes every
  controller's response automatically.
- **~30 lines for one route, with no typed contract at all.** Nothing here stops the
  `"type": "string"` field from silently becoming `"type": "str"` — it's a raw string
  being built, checked by nothing. Real Java would add a typed DTO (a `record`) *and* a
  JSON library to get back the guarantee `WidgetParamType = 'integer' | 'string'` gives
  for free in `service-provider.interface.ts`.
- **Startup ceremony.** Even with zero dependencies, this needs `HttpServer.create(...)`,
  an explicit context + handler, manual header/status/body writing to an `OutputStream` —
  a full HTTP framework (Spring Boot) would remove most of that, at the cost of the
  dependency + build tool this POC deliberately avoided to stay "very short."
- **The JVM itself is a real, if modest, operational cost**: a JVM warms up and holds a
  baseline memory footprint noticeably higher than Node's — irrelevant at this app's scale,
  but part of what "suitability for scheduled refresh" scored in the matrix.

## Conclusion

Confirms the matrix: Java (with or without Spring Boot) is entirely capable of this app,
and this POC proves the core mechanics work with zero setup — but every advantage it has
(strong typing, a mature ecosystem) needs extra dependencies Node's `JSON`/NestJS already
include, and neither of us had shipped a real Java backend before, unlike NestJS.

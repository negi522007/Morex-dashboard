# Proofs of concept — the technology comparison, run for real

[ARCHITECTURE.md](../docs/ARCHITECTURE.md)'s "Technology choices" section compares the stack
actually used (Node.js/NestJS, React, PostgreSQL, Prisma) against real alternatives on a
written decision matrix. This folder is the other half of that: a small, runnable POC for
every alternative that matrix scored, each doing the same job as a real piece of this app
(mostly `/about.json`'s contract, or the scheduler's "which widgets are due" comparison),
so the comparison rests on something that was actually built and executed, not only on
opinions in a table.

Each POC's own `README.md` has the exact commands to reproduce it, the output it actually
produced, and what that run confirmed or complicated about the corresponding row of the
decision matrix.

| Layer | Chosen | Alternative tested here | POC |
| --- | --- | --- | --- |
| Backend language | Node.js / NestJS | Python (Flask) | [`backend-language/python-flask`](./backend-language/python-flask) |
| Backend language | Node.js / NestJS | Java (JDK `HttpServer`) | [`backend-language/java-httpserver`](./backend-language/java-httpserver) |
| Database | PostgreSQL | MySQL | [`database/mysql`](./database/mysql) |
| Database | PostgreSQL | MongoDB | [`database/mongodb`](./database/mongodb) |
| ORM | Prisma | TypeORM | [`orm/typeorm`](./orm/typeorm) |

None of this code is part of the running application — it's throwaway, self-contained, and
never imported by `backend/` or `frontend/`. Nothing here needs the real Postgres/Docker
stack except the two database POCs, which start and tear down their own disposable
container.

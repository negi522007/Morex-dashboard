# POC — MySQL vs PostgreSQL

What this tests: the "Database" row of the decision matrix in
[ARCHITECTURE.md](../../../ARCHITECTURE.md) — storing the same two things PostgreSQL
stores for real (a user owning widget instances with free-form `config`, and the exact
comparison the scheduler's due-widgets query needs), run against a real MySQL 8 container.

## Run it

```bash
docker run --rm -d --name mysql-poc -e MYSQL_ROOT_PASSWORD=poc -e MYSQL_DATABASE=poc mysql:8
# wait for it to accept connections (docker exec mysql-poc mysqladmin ping -uroot -ppoc)
docker exec -i mysql-poc mysql -uroot -ppoc poc < poc/database/mysql/init.sql
docker rm -f mysql-poc
```

Verified output (only `w1`, seeded 90s ago with a 60s refresh rate, is due — `w2`, seeded
10s ago with a 300s rate, correctly isn't):
```
id	service_name	widget_name	last_refreshed_at
w1	rss	article_list	2026-09-28 23:31:23
```

## What it confirmed

- **The JSON column works, but the tooling around it is thinner.** MySQL's `JSON` type
  stores and queries fine (`JSON_OBJECT(...)` to build one, ordinary column access to read
  it back), but Prisma's own MySQL connector has weaker `Json` field support than its
  PostgreSQL one in practice (fewer of Prisma's JSON filter operators are available), and
  MySQL's `JSON` has no direct equivalent to `jsonb`'s binary, indexable storage — you'd
  reach for a generated column + index if you ever needed to query *inside* `config` at
  scale, which this app doesn't do (config is only ever read whole, never filtered on).
- **The scheduler's due-widgets query needed different interval syntax.** PostgreSQL:
  `"lastRefreshedAt" + ("refreshRateSeconds" * INTERVAL '1 second')` — multiplying an
  interval literal by a column. MySQL has no such multiplication form; the column has to go
  directly inside `INTERVAL`: `last_refreshed_at + INTERVAL refresh_rate_seconds SECOND`.
  Both are one-line fixes, not a real blocker — just a reminder that "the same SQL" isn't
  actually portable as soon as you leave the most basic `SELECT`/`WHERE`.
- **Foreign keys + cascading delete work identically** (`ON DELETE CASCADE`) — this part of
  the decision (relational integrity on `User → WidgetInstance` and friends) is a wash
  between MySQL and PostgreSQL; it's not what decided the matrix.

## Conclusion

Confirms the matrix: MySQL would have worked fine for this app's relational core. The
deciding factor was PostgreSQL's stronger, more idiomatic JSON support (`jsonb`, better
Prisma tooling for it) for the columns that really are free-form (`config`, `cachedData`,
`insight`) — a real but modest difference, not a hard blocker either way.

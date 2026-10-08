# POC — MongoDB vs PostgreSQL

What this tests: the "Database" row of the decision matrix in
[ARCHITECTURE.md](../../../docs/ARCHITECTURE.md) — the same two things the MySQL POC tests
(storing free-form widget `config`, running the scheduler's due-widgets comparison), this
time against a real MongoDB document store instead of a relational one.

## Run it

```bash
docker run --rm -d --name mongo-poc -p 27018:27017 mongo:7
mongosh mongodb://localhost:27018/poc poc/database/mongodb/seed-and-query.js
docker rm -f mongo-poc
```

Verified output (same due/not-due setup as the MySQL POC):
```
Due widgets: ["rss/article_list"]
```

## What it confirmed

- **Storing `config` is genuinely more natural here.** No JSON column at all — every
  document is already free-form, so `config: { link: "...", number: 3 }` is just... the
  document. This is the one real structural point in Mongo's favor for this app's shape
  (`config`, `cachedData`, `insight` are all schema-less by nature).
- **The due-widgets query needs `$expr` + `$lte` + `$add`/`$multiply` to compare two fields
  of the same document** — Mongo's plain filter syntax (`{ field: value }`) can't express
  "column A plus column B, compared to now," only `$expr`'s embedded aggregation
  expressions can. The equivalent SQL (`last_refreshed_at + refresh_rate_seconds seconds <=
  NOW()`) is a single readable clause; this needed to become a small nested expression tree.
- **No foreign keys, no cascade delete.** `users`/`widget_instances` are linked only by
  convention (`userId` field, never enforced) — deleting a user does NOT delete their
  widgets automatically the way `onDelete: Cascade` does in `schema.prisma`; the app would
  have to delete both by hand (or accept orphaned documents), and get every deletion path
  right by discipline rather than by the database refusing an inconsistent state.
- **Every table in this app but one is relational by nature**: a `User` owns `Session`s,
  `OAuthAccount`s, `WidgetInstance`s, `Alert`s, `ShareLink`s — ownership, cascading deletes
  on account removal, and uniqueness across two columns (`(provider, providerAccountId)`
  for OAuth, `(userId, serviceName)` for subscriptions) are exactly what a relational
  database is for. Only `config`/`cachedData`/`insight` are truly free-form, and PostgreSQL
  already stores those as `jsonb` — so choosing Mongo would trade a real modeling advantage
  in 5% of the schema for real relational integrity lost in the other 95%.

## Conclusion

Confirms the matrix: MongoDB is a legitimate, well-supported choice and this POC works
cleanly, but this app's data is overwhelmingly relational (ownership + cascades +
uniqueness constraints across 8+ models) with only a few genuinely free-form columns —
and PostgreSQL's `jsonb` already covers those, at no modeling cost anywhere else.

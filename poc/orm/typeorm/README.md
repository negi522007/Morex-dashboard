# POC — TypeORM vs Prisma

What this tests: the "ORM / data access" row of the decision matrix in
[ARCHITECTURE.md](../../../ARCHITECTURE.md) — the same `User`/`WidgetInstance` shape as
`backend/prisma/schema.prisma` (simplified), and the scheduler's own due-widgets logic,
built with TypeORM entities + query builder instead of Prisma.

## Run it

```bash
cd poc/orm/typeorm
npm install
./node_modules/.bin/ts-node index.ts
```

Verified output (an in-memory sqlite DB, seeded with one due widget and one not-due one,
same 90s-ago/60s-rate vs 10s-ago/300s-rate setup as the MySQL and MongoDB POCs):
```
Due widgets: [ 'rss/article_list' ]
```

## What it confirmed

- **Decorators instead of a schema file.** `entities.ts` needs `reflect-metadata`,
  `experimentalDecorators`/`emitDecoratorMetadata` in `tsconfig.json`, and one decorator per
  column (`@Column`, `@PrimaryGeneratedColumn`, `@ManyToOne`...) — `schema.prisma`'s
  equivalent is declarative, one line per field, no decorators, no separate compiler flags.
  Both are typed; TypeORM's types are hand-written on each property (nothing checks
  `config!: Record<string, string | number>` actually matches what `@Column({ type:
  'simple-json' })` stores), where Prisma *generates* the client's types straight from the
  schema — the exact mistake `int` vs `integer` from the Python POC becomes possible again
  here, just with TypeScript syntax around it.
- **No equivalent of `docker-entrypoint.sh`'s automatic migration.** This project's
  container start runs `prisma migrate deploy` unconditionally, safe to run every time.
  TypeORM ships `synchronize: true` (used above) for dev convenience only — its own docs
  warn against it in production, since it can silently drop/alter columns to match the
  entities; real migrations have to be generated and reviewed by hand
  (`typeorm migration:generate`), then applied by a step someone has to remember to run.
- **The due-widgets comparison needed the query builder's raw-ish `.orWhere(sqlString)`**,
  not a fully type-checked filter object — closer to Prisma's own `$queryRaw` escape hatch
  (used for this exact query in `timer.service.ts`) than to either ORM's "normal" query
  API. Neither ORM's query builder can express "column A + column B compared to now"
  without dropping to a SQL string fragment.

## Conclusion

Confirms the matrix: TypeORM is capable and this POC works, but Prisma's schema-generated
types (one source of truth, no drift between the schema and what TypeScript believes about
it) and its migrations applying automatically and safely at container start (no
`synchronize: true` production footgun) were the deciding factors — lower boilerplate for
the same result, and a production migration story the project's Docker setup already
depends on.

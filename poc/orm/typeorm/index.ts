// POC — create a user + a due widget instance, then run TimerService's own "which
// widgets are due" logic through TypeORM's query builder instead of Prisma's $queryRaw,
// against a throwaway in-memory sqlite DB (no external service needed to run this POC).
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User, WidgetInstance } from './entities';

async function main() {
  const ds = new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    synchronize: true, // dev-only convenience, same role as `prisma migrate dev` — TypeORM has no
    // built-in production migration runner as opinionated as Prisma's; you write and order
    // migration files yourself (or a schema-diff tool), and nothing applies them
    // automatically at container start the way this project's docker-entrypoint.sh does.
    entities: [User, WidgetInstance],
  });
  await ds.initialize();

  const userRepo = ds.getRepository(User);
  const widgetRepo = ds.getRepository(WidgetInstance);

  const user = await userRepo.save(userRepo.create({ email: 'ada@example.com' }));
  await widgetRepo.save(
    widgetRepo.create({
      serviceName: 'rss',
      widgetName: 'article_list',
      config: { link: 'https://hnrss.org/frontpage', number: 3 },
      refreshRateSeconds: 60,
      lastRefreshedAt: new Date(Date.now() - 90_000), // 90s ago, due (rate is 60s)
      user,
    }),
  );
  await widgetRepo.save(
    widgetRepo.create({
      serviceName: 'weather',
      widgetName: 'current_weather',
      config: { city: 'Cotonou' },
      refreshRateSeconds: 300,
      lastRefreshedAt: new Date(Date.now() - 10_000), // 10s ago, not due (rate is 300s)
      user,
    }),
  );

  // TimerService's real query is one hand-written $queryRaw (see timer.service.ts) because
  // "lastRefreshedAt + refreshRateSeconds seconds <= now" has no clean Prisma query-builder
  // equivalent (Prisma can't add a column to an interval derived from another column in a
  // WHERE clause). TypeORM's query builder CAN express it directly:
  const due = await widgetRepo
    .createQueryBuilder('w')
    .where('w.lastRefreshedAt IS NULL')
    .orWhere("datetime(w.lastRefreshedAt, '+' || w.refreshRateSeconds || ' seconds') <= datetime('now')")
    .getMany();

  console.log(
    'Due widgets:',
    due.map((w) => `${w.serviceName}/${w.widgetName}`),
  );
  await ds.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

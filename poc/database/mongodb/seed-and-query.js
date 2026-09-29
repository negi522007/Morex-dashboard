// POC — the same two collections as the MySQL/PostgreSQL POCs (users owning widget
// instances, the scheduler's due-widgets query), as MongoDB documents instead of
// relational rows. Run with: mongosh mongodb://localhost:27018/poc seed-and-query.js

db.widget_instances.drop();
db.users.drop();

const userId = db.users.insertOne({ email: "ada@example.com" }).insertedId;

// Prisma: `config Json` maps straight to a jsonb column, still queried with SQL.
// MongoDB: config is a native, deeply-nested document field — no separate "JSON column"
// concept exists because EVERYTHING is already a document. This is the one genuine
// structural advantage MongoDB has for this app's free-form data (widget config,
// cachedData, insight) — the trade-off is everything else (see README.md in this folder).
db.widget_instances.insertMany([
  {
    userId,
    serviceName: "rss",
    widgetName: "article_list",
    config: { link: "https://hnrss.org/frontpage", number: 3 },
    refreshRateSeconds: 60,
    lastRefreshedAt: new Date(Date.now() - 90_000), // due
  },
  {
    userId,
    serviceName: "weather",
    widgetName: "current_weather",
    config: { city: "Cotonou" },
    refreshRateSeconds: 300,
    lastRefreshedAt: new Date(Date.now() - 10_000), // not due
  },
]);

// TimerService's due-query (a single SQL WHERE clause in the real app) becomes a
// $expr aggregation stage in Mongo's query language — comparing two fields of the
// same document needs $expr; a plain filter object can't do it.
const due = db.widget_instances
  .find({
    $or: [
      { lastRefreshedAt: null },
      {
        $expr: {
          $lte: [
            { $add: ["$lastRefreshedAt", { $multiply: ["$refreshRateSeconds", 1000] }] },
            new Date(),
          ],
        },
      },
    ],
  })
  .toArray();

print("Due widgets:", JSON.stringify(due.map((w) => `${w.serviceName}/${w.widgetName}`)));

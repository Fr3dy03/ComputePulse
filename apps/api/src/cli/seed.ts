import { getDb } from '../db/client.js';
import { seedStatic } from '../db/seed.js';

const db = await getDb();
await seedStatic(db);
const [networks, metrics, monitors, rules] = await Promise.all([
  db.query<{ count: string }>('SELECT count(*)::text AS count FROM networks'),
  db.query<{ count: string }>('SELECT count(*)::text AS count FROM metric_definitions'),
  db.query<{ count: string }>('SELECT count(*)::text AS count FROM monitors'),
  db.query<{ count: string }>('SELECT count(*)::text AS count FROM alert_rules'),
]);
console.log(
  JSON.stringify(
    {
      database: db.kind,
      networks: Number(networks.rows[0]?.count ?? 0),
      metricDefinitions: Number(metrics.rows[0]?.count ?? 0),
      monitors: Number(monitors.rows[0]?.count ?? 0),
      alertRules: Number(rules.rows[0]?.count ?? 0),
    },
    null,
    2,
  ),
);
await db.close();

import { getDb, closeDb } from '../db/client.js';
import { seedStatic } from '../db/seed.js';
import { collectAll, collectNetwork } from '../services/collector.js';
import { seedCorrelatedIncident } from '../services/incidents.js';
import { runDueMonitors } from '../services/monitors.js';

const args = process.argv.slice(2);
const networkArg = args.find((arg) => arg.startsWith('--network='))?.split('=')[1];
const checkMonitors = args.includes('--monitors');

const db = await getDb();
await seedStatic(db);

if (networkArg) {
  const started = Date.now();
  const result = await collectNetwork(networkArg, 'cli');
  console.log(JSON.stringify(result, null, 2));
  console.log(`Completed in ${((Date.now() - started) / 1000).toFixed(1)}s`);
} else {
  const started = Date.now();
  const results = await collectAll('cli');
  console.log(JSON.stringify(results, null, 2));
  console.log(`Completed in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

const incident = await seedCorrelatedIncident(db);
if (incident) {
  console.log(
    `Correlated incident ${incident.id} from a source-reported offline provider.`,
  );
}

if (checkMonitors) {
  const outcomes = await runDueMonitors('cli');
  console.log(JSON.stringify({ monitorChecks: outcomes }, null, 2));
}

const counts = await db.query<{
  providers: string;
  observations: string;
  incidents: string;
  checks: string;
}>(
  `SELECT
     (SELECT count(*)::text FROM providers) AS providers,
     (SELECT count(*)::text FROM observations) AS observations,
     (SELECT count(*)::text FROM incidents) AS incidents,
     (SELECT count(*)::text FROM monitor_checks) AS checks`,
);
console.log(JSON.stringify(counts.rows[0], null, 2));
await closeDb();

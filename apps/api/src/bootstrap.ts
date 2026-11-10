import type { FastifyBaseLogger } from 'fastify';
import { getDb } from './db/client.js';
import { collectNetwork } from './services/collector.js';
import { seedCorrelatedIncident } from './services/incidents.js';
import { runDueMonitors } from './services/monitors.js';
import { adapters } from './adapters/registry.js';

let bootstrapped = false;

export async function bootstrapData(log: FastifyBaseLogger) {
  if (bootstrapped) return;
  bootstrapped = true;
  const db = await getDb();
  const providers = await db.query<{ count: string }>(
    'SELECT count(*)::text AS count FROM providers',
  );

  if (Number(providers.rows[0]?.count ?? 0) === 0) {
    log.info('no provider data found; running first real source collection');
    const networkIds = [
      ...new Set(adapters.map((adapter) => adapter.metadata.networkId)),
    ];
    for (const networkId of networkIds) {
      try {
        const result = await collectNetwork(networkId, 'bootstrap');
        log.info(result, 'bootstrap collection complete');
      } catch (error) {
        log.error({ err: error, networkId }, 'bootstrap collection failed');
      }
    }
  }

  try {
    const incident = await seedCorrelatedIncident(db);
    if (incident) {
      log.info(
        { incidentId: incident.id, providerId: incident.provider_id },
        'correlated a source-reported offline provider into an incident',
      );
    }
  } catch (error) {
    log.error({ err: error }, 'incident correlation bootstrap failed');
  }

  try {
    const outcomes = await runDueMonitors('bootstrap');
    if (outcomes.length > 0) {
      log.info({ checked: outcomes.length }, 'bootstrap endpoint checks complete');
    }
  } catch (error) {
    log.error({ err: error }, 'bootstrap monitor checks failed');
  }
}

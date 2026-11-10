import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { env } from './env.js';
import { getDb, closeDb } from './db/client.js';
import { seedStatic } from './db/seed.js';
import { registerRoutes } from './routes/index.js';
import { httpRequestDuration, metricsContentType, renderMetrics } from './observability/metrics.js';
import { startSchedulers } from './scheduler.js';

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
    bodyLimit: 1_048_576,
    trustProxy: true,
  });

  await app.register(cors, {
    origin: [
      env.APP_ORIGIN,
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['content-type', 'authorization', 'x-admin-token'],
    credentials: false,
    maxAge: 86_400,
  });

  await app.register(rateLimit, {
    max: 240,
    timeWindow: '1 minute',
    allowList: ['127.0.0.1', '::1'],
    errorResponseBuilder: () => ({
      error: 'rate_limited',
      message: 'Too many requests. Try again shortly.',
    }),
  });

  app.addHook('onResponse', async (request, reply) => {
    const route = request.routeOptions.url ?? request.url;
    httpRequestDuration
      .labels(request.method, route, String(reply.statusCode))
      .observe(reply.elapsedTime / 1000);
  });

  app.setErrorHandler((error, request, reply) => {
    const fastifyError = error as Error & { statusCode?: number };
    const status = fastifyError.statusCode ?? 500;
    request.log.error({ err: fastifyError }, 'request failed');
    reply.status(status).send({
      error: status >= 500 ? 'internal_error' : 'request_error',
      message:
        status >= 500 && env.NODE_ENV === 'production'
          ? 'The request could not be completed.'
          : fastifyError.message,
    });
  });

  app.get('/metrics', async (_request, reply) => {
    reply.header('content-type', metricsContentType);
    return reply.send(await renderMetrics());
  });

  await registerRoutes(app);

  app.get('/health', async (_request, reply) => {
    try {
      const db = await getDb();
      await db.query('SELECT 1');
      return {
        status: 'ok',
        service: 'computepulse-api',
        version: '1.0.0',
        database: db.kind,
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      reply.status(503);
      return {
        status: 'unavailable',
        service: 'computepulse-api',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });

  await app.register(async (scope) => {
    scope.addHook('onClose', async () => {
      await closeDb();
    });
  });

  return app;
}

export async function start() {
  if (env.OTEL_ENABLED) {
    const { startTelemetry } = await import('./telemetry.js');
    await startTelemetry();
  }
  const app = await buildServer();
  const db = await getDb();
  await seedStatic(db);

  if (env.AUTO_BOOTSTRAP) {
    const { bootstrapData } = await import('./bootstrap.js');
    void bootstrapData(app.log).catch((error) => {
      app.log.error({ err: error }, 'background bootstrap failed');
    });
  }
  if (env.MONITOR_SCHEDULER_ENABLED || env.COLLECTOR_ENABLED) {
    startSchedulers(app.log);
  }

  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(
    `ComputePulse API listening on http://${env.HOST}:${env.PORT} (database: ${db.kind})`,
  );

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  return app;
}

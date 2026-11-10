import { env } from './env.js';

let sdk: { shutdown: () => Promise<void> } | null = null;

export async function startTelemetry() {
  if (!env.OTEL_ENABLED || sdk) return;
  const { NodeSDK } = await import('@opentelemetry/sdk-node');
  const { getNodeAutoInstrumentations } = await import(
    '@opentelemetry/auto-instrumentations-node'
  );
  const { OTLPTraceExporter } = await import(
    '@opentelemetry/exporter-trace-otlp-http'
  );
  const instance = new NodeSDK({
    serviceName: env.OTEL_SERVICE_NAME,
    traceExporter: env.OTEL_EXPORTER_OTLP_ENDPOINT
      ? new OTLPTraceExporter({
          url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/$/, '')}/v1/traces`,
        })
      : undefined,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });
  instance.start();
  sdk = instance;
}

export async function stopTelemetry() {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
  }
}

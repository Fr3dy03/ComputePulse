const USER_AGENT =
  'ComputePulse/1.0 (+provider-observability; one collection per scheduled interval)';

export interface FetchJsonOptions {
  timeoutMs?: number;
  retries?: number;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
  maxBytes?: number;
}

export interface TimedTextResult {
  text: string;
  status: number;
  latencyMs: number;
  bytes: number;
  headers: Headers;
}

export async function fetchTextTimed(
  url: string,
  options: FetchJsonOptions = {},
): Promise<TimedTextResult> {
  const {
    timeoutMs = 90_000,
    retries = 2,
    method = 'GET',
    headers = {},
    body,
    signal,
    maxBytes = 12 * 1024 * 1024,
  } = options;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const started = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const abortFromParent = () => controller.abort();
    signal?.addEventListener('abort', abortFromParent, { once: true });
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'user-agent': USER_AGENT,
          accept: 'application/json',
          ...headers,
        },
        body,
        signal: controller.signal,
        redirect: 'follow',
      });
      const text = await readLimited(response, maxBytes);
      const latencyMs = Math.round(performance.now() - started);
      if (!response.ok) {
        throw new Error(
          `Source returned HTTP ${response.status} ${response.statusText}`.trim(),
        );
      }
      return {
        text,
        status: response.status,
        latencyMs,
        bytes: Buffer.byteLength(text),
        headers: response.headers,
      };
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) =>
          setTimeout(resolve, 500 * 2 ** attempt),
        );
      }
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abortFromParent);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('Source request failed');
}

export async function readLimited(
  response: Response,
  maxBytes: number,
): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        throw new Error(`Response exceeded the ${maxBytes} byte safety limit`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8');
}

export function parseJson<T>(text: string, source: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${source} returned a non-JSON response`);
  }
}

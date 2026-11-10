import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../env.js';

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

export interface Database {
  readonly kind: 'pglite' | 'postgres';
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
  exec(text: string): Promise<void>;
  close(): Promise<void>;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(here, 'schema.sql');

let databasePromise: Promise<Database> | null = null;

class PgliteDatabase implements Database {
  readonly kind = 'pglite' as const;

  constructor(private readonly client: import('@electric-sql/pglite').PGlite) {}

  async query<T>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
    const result = await this.client.query<T>(text, params);
    return {
      rows: result.rows,
      rowCount: result.affectedRows ?? result.rows.length,
    };
  }

  async exec(text: string): Promise<void> {
    await this.client.exec(text);
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

class PostgresDatabase implements Database {
  readonly kind = 'postgres' as const;

  constructor(private readonly pool: import('pg').Pool) {}

  async query<T>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
    const result = await this.pool.query(text, params);
    return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
  }

  async exec(text: string): Promise<void> {
    await this.pool.query(text);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

async function createDatabase(): Promise<Database> {
  if (env.DATABASE_URL) {
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000,
    });
    const db = new PostgresDatabase(pool);
    await db.query('SELECT 1');
    return db;
  }

  const { PGlite } = await import('@electric-sql/pglite');
  await fs.mkdir(path.dirname(env.PGLITE_DIR), { recursive: true });
  const pglite = await PGlite.create({ dataDir: env.PGLITE_DIR });
  return new PgliteDatabase(pglite);
}

export async function getDb(): Promise<Database> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await createDatabase();
      const schema = await fs.readFile(schemaPath, 'utf8');
      await db.exec(schema);
      return db;
    })();
  }
  return databasePromise;
}

export async function closeDb(): Promise<void> {
  if (databasePromise) {
    const db = await databasePromise;
    await db.close();
    databasePromise = null;
  }
}

export async function withTransaction<T>(
  db: Database,
  fn: (tx: Database) => Promise<T>,
): Promise<T> {
  await db.query('BEGIN');
  try {
    const result = await fn(db);
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

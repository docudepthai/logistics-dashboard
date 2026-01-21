import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index.js';

const { Pool } = pg;

/**
 * Database connection configuration
 */
export interface DatabaseConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

/**
 * Create a database client with connection pooling
 */
export function createDatabaseClient(config?: DatabaseConfig) {
  const connectionString =
    config?.connectionString || process.env.DATABASE_URL;

  const poolConfig: pg.PoolConfig = connectionString
    ? {
        connectionString,
        ssl: config?.ssl ? { rejectUnauthorized: false } : undefined,
        max: config?.max ?? 10,
        idleTimeoutMillis: config?.idleTimeoutMillis ?? 30000,
        connectionTimeoutMillis: config?.connectionTimeoutMillis ?? 5000,
      }
    : {
        host: config?.host ?? process.env.DB_HOST ?? 'localhost',
        port: config?.port ?? parseInt(process.env.DB_PORT ?? '5432', 10),
        database: config?.database ?? process.env.DB_NAME ?? 'logistics',
        user: config?.user ?? process.env.DB_USER ?? 'logistics_user',
        password:
          config?.password ?? process.env.DB_PASSWORD ?? 'logistics_dev',
        ssl: config?.ssl ? { rejectUnauthorized: false } : undefined,
        max: config?.max ?? 10,
        idleTimeoutMillis: config?.idleTimeoutMillis ?? 30000,
        connectionTimeoutMillis: config?.connectionTimeoutMillis ?? 5000,
      };

  const pool = new Pool(poolConfig);

  const db = drizzle(pool, { schema });

  return {
    db,
    pool,
    /**
     * Close the database connection pool
     */
    async close() {
      await pool.end();
    },
    /**
     * Check if the database is reachable
     */
    async healthCheck(): Promise<boolean> {
      try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        return true;
      } catch {
        return false;
      }
    },
  };
}

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;
export type Database = DatabaseClient['db'];

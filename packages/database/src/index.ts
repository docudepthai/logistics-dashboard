// Database client
export {
  createDatabaseClient,
  type DatabaseConfig,
  type DatabaseClient,
  type Database,
} from './client.js';

// Schema exports
export * from './schema/index.js';

// Query exports
export * from './queries/index.js';

// Re-export drizzle-orm operators for use in other packages
export { eq, and, or, desc, asc, sql } from 'drizzle-orm';

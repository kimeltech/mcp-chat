import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// This file should only be imported in server-side code
// Import this in API routes, Server Components, and Server Actions only

let pool: Pool | null = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Additional PostgreSQL options
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pool;
}

// Initialize Drizzle with the connection pool and schema
export const db = drizzle(getPool(), { schema });

// Export pool for direct access if needed
export { getPool };

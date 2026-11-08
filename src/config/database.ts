import "dotenv/config";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("A variável DATABASE_URL não foi configurada.");
}

export const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

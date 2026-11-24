import pg from "pg";

const { Pool, types } = pg;

types.setTypeParser(1082, (value) => value);
types.setTypeParser(1700, (value) => Number(value));
types.setTypeParser(20, (value) => Number(value));

function connectionString() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error(
      "DATABASE_URL is missing. Copy .env.example to .env and add your Supabase connection string.",
    );
  }
  const url = new URL(raw);
  url.searchParams.delete("sslmode");
  return url.toString();
}

export const pool = new Pool({
  connectionString: connectionString(),
  ssl:
    process.env.DATABASE_SSL === "false"
      ? false
      : { rejectUnauthorized: false },
  max: Number(process.env.DATABASE_POOL_SIZE) || 5,
});

pool.on("error", (error) => {
  console.error("Database connection error:", error.message);
});

export function query(text, params) {
  return pool.query(text, params);
}

export async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

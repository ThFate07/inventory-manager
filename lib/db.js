let pool;
let poolPromise;

export function getDatabaseUrl() {
  return process.env.DATABASE_URL || "";
}

export function hasDatabaseConfig() {
  return Boolean(getDatabaseUrl());
}

export async function getPool() {
  if (!hasDatabaseConfig()) {
    return null;
  }

  if (pool) {
    return pool;
  }

  if (!poolPromise) {
    poolPromise = import("pg").then(({ Pool }) => {
      pool = new Pool({
        connectionString: getDatabaseUrl(),
        ssl:
          process.env.POSTGRES_SSL === "require"
            ? { rejectUnauthorized: false }
            : undefined,
      });

      return pool;
    });
  }

  return poolPromise;
}

export async function withClient(callback) {
  const currentPool = await getPool();

  if (!currentPool) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const client = await currentPool.connect();

  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

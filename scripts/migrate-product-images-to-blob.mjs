import { put } from "@vercel/blob";
import { Client } from "pg";

function decodeDataUrl(dataUrl) {
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/i.exec(dataUrl);

  if (!match) {
    throw new Error("Unsupported image data.");
  }

  const contentType = match[1] || "application/octet-stream";
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || "";
  const body = isBase64
    ? Buffer.from(payload, "base64")
    : Buffer.from(decodeURIComponent(payload), "utf8");

  return {
    body,
    contentType,
  };
}

function sanitizeSegment(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "image";
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required.");
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.POSTGRES_SSL === "require"
        ? { rejectUnauthorized: false }
        : undefined,
  });

  await client.connect();

  try {
    const result = await client.query(`
      select id, code, image_url
      from products
      where image_url like 'data:%'
      order by id asc
    `);

    for (const row of result.rows) {
      const { body, contentType } = decodeDataUrl(row.image_url);
      const extension = contentType.split("/")[1] || "bin";
      const key = `products/${sanitizeSegment(row.code)}/${Date.now()}-${row.id}.${extension}`;
      const uploaded = await put(key, new Blob([body], { type: contentType }), {
        access: "public",
        addRandomSuffix: true,
        contentType,
      });

      await client.query(
        `
          update products
          set image_url = $2,
              updated_at = now()
          where id = $1
        `,
        [row.id, uploaded.url],
      );

      console.log(`Migrated product ${row.id} (${row.code})`);
    }

    console.log(`Migrated ${result.rowCount} database-stored image${result.rowCount === 1 ? "" : "s"} to Blob.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

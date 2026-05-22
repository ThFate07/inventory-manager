import { Client } from "pg";
import crypto from "crypto";

const sampleProducts = [
  {
    code: "CRK-101",
    name: "Classic Dinner Plate",
    category: "Plates",
    ctn: "",
    qtyPerCtn: "",
    stockQuantity: 120,
    unitPriceInr: 249,
    imageUrl:
      "https://images.unsplash.com/photo-1603190287605-e6ade32fa852?q=80&w=1200&auto=format&fit=crop",
  },
  {
    code: "CRK-202",
    name: "Royal Tea Cup Set",
    category: "Cups",
    ctn: "",
    qtyPerCtn: "",
    stockQuantity: 80,
    unitPriceInr: 499,
    imageUrl:
      "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?q=80&w=1200&auto=format&fit=crop",
  },
  {
    code: "CRK-303",
    name: "Premium Serving Bowl",
    category: "Bowls",
    ctn: "",
    qtyPerCtn: "",
    stockQuantity: 45,
    unitPriceInr: 699,
    imageUrl:
      "https://images.unsplash.com/photo-1610701596061-2ecf227e85b2?q=80&w=1200&auto=format&fit=crop",
  },
  {
    code: "CRK-404",
    name: "Designer Glass Set",
    category: "Glasses",
    ctn: "",
    qtyPerCtn: "",
    stockQuantity: 60,
    unitPriceInr: 899,
    imageUrl:
      "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?q=80&w=1200&auto=format&fit=crop",
  },
];

function slugifyCategory(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "general";
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.POSTGRES_SSL === "require"
        ? { rejectUnauthorized: false }
        : undefined,
  });

  await client.connect();
  await client.query("begin");

  try {
    await client.query(`
      create table if not exists categories (
        id bigserial primary key,
        name text not null unique,
        slug text not null unique,
        created_at timestamptz not null default now()
      );
    `);

    await client.query(`
      create table if not exists products (
        id bigserial primary key,
        code text not null unique,
        name text not null,
        category_id bigint not null references categories(id) on delete restrict,
        ctn text not null default '',
        qty_per_ctn text not null default '',
        catalog_unit text not null default '1 pcs',
        stock_quantity integer not null default 0 check (stock_quantity >= 0),
        unit_price_inr numeric(12, 2) not null default 0 check (unit_price_inr >= 0),
        image_url text not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    `);

    await client.query(`
      create table if not exists admin_users (
        id bigserial primary key,
        username text not null unique,
        password_hash text not null,
        display_name text not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    `);

    await client.query(`
      create table if not exists inventory_activity_logs (
        id bigserial primary key,
        action text not null,
        product_id bigint references products(id) on delete set null,
        product_code text,
        product_name text,
        category text,
        details text not null,
        created_at timestamptz not null default now()
      );
    `);

    for (const categoryName of [...new Set(sampleProducts.map((product) => product.category))]) {
      await client.query(
        `
          insert into categories (name, slug)
          values ($1, $2)
          on conflict (name)
          do update set slug = excluded.slug
        `,
        [categoryName, slugifyCategory(categoryName)],
      );
    }

    for (const product of sampleProducts) {
      const categoryResult = await client.query(
        "select id from categories where name = $1",
        [product.category],
      );

      await client.query(
        `
          insert into products (code, name, category_id, ctn, qty_per_ctn, catalog_unit, stock_quantity, unit_price_inr, image_url)
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          on conflict (code)
          do update set
            name = excluded.name,
            category_id = excluded.category_id,
            ctn = excluded.ctn,
            qty_per_ctn = excluded.qty_per_ctn,
            catalog_unit = excluded.catalog_unit,
            stock_quantity = excluded.stock_quantity,
            unit_price_inr = excluded.unit_price_inr,
            image_url = excluded.image_url,
            updated_at = now()
        `,
        [
          product.code,
          product.name,
          categoryResult.rows[0].id,
          product.ctn || "",
          product.qtyPerCtn || "",
          product.catalogUnit || "1 pcs",
          product.stockQuantity,
          product.unitPriceInr,
          product.imageUrl,
        ],
      );
    }

    const username = process.env.ADMIN_USERNAME || "admin";
    const password = process.env.ADMIN_PASSWORD || "admin123";
    const displayName = process.env.ADMIN_DISPLAY_NAME || "Store Admin";

    await client.query(
      `
        insert into admin_users (username, password_hash, display_name)
        values ($1, $2, $3)
        on conflict (username)
        do update set
          password_hash = excluded.password_hash,
          display_name = excluded.display_name,
          updated_at = now()
      `,
      [username, hashPassword(password), displayName],
    );

    await client.query("commit");
    console.log("Database tables and seed data are ready.");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

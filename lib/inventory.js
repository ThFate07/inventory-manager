import { hasDatabaseConfig, withClient } from "./db";
import { hashPassword, verifyPassword } from "./auth";
import { deriveCategories, sampleProducts, slugifyCategory } from "./sample-data";

let setupPromise;

function defaultAdminConfig() {
  return {
    username: process.env.ADMIN_USERNAME || "admin",
    password: process.env.ADMIN_PASSWORD || "admin123",
    displayName: process.env.ADMIN_DISPLAY_NAME || "Store Admin",
  };
}

function normalizeProduct(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    stockQuantity: Number(row.stock_quantity),
    unitPriceInr: Number(row.unit_price_inr),
    imageUrl: row.image_url,
  };
}

function createOrderId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `ORD-${timestamp}-${randomPart}`;
}

function normalizeOrder(row) {
  return {
    id: row.id,
    orderId: row.order_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    notes: row.notes,
    status: row.status,
    paymentStatus: row.payment_status,
    totalAmountInr: Number(row.total_amount_inr),
    confirmedAt: row.confirmed_at,
    createdAt: row.created_at,
  };
}

function normalizeInventoryLog(row) {
  return {
    id: row.id,
    action: row.action,
    productId: row.product_id,
    productCode: row.product_code,
    productName: row.product_name,
    details: row.details,
    createdAt: row.created_at,
  };
}

function normalizeOrderHistoryRow(row) {
  return {
    ...normalizeOrder(row),
    itemCount: Number(row.item_count || 0),
    totalQuantity: Number(row.total_quantity || 0),
    items: [],
  };
}

function formatCurrencyForLog(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

async function insertInventoryLog(client, entry) {
  await client.query(
    `
      insert into inventory_activity_logs (
        action,
        product_id,
        product_code,
        product_name,
        details
      )
      values ($1, $2, $3, $4, $5)
    `,
    [
      entry.action,
      entry.productId ?? null,
      entry.productCode ?? null,
      entry.productName ?? null,
      entry.details,
    ],
  );
}

function describeProductChanges(previousProduct, nextProduct) {
  const changes = [];

  if (previousProduct.code !== nextProduct.code) {
    changes.push(`code ${previousProduct.code} -> ${nextProduct.code}`);
  }
  if (previousProduct.name !== nextProduct.name) {
    changes.push(`name "${previousProduct.name}" -> "${nextProduct.name}"`);
  }
  if (previousProduct.category !== nextProduct.category) {
    changes.push(`category ${previousProduct.category} -> ${nextProduct.category}`);
  }
  if (Number(previousProduct.stockQuantity) !== Number(nextProduct.stockQuantity)) {
    changes.push(
      `stock ${previousProduct.stockQuantity} -> ${nextProduct.stockQuantity}`,
    );
  }
  if (Number(previousProduct.unitPriceInr) !== Number(nextProduct.unitPriceInr)) {
    changes.push(
      `price ${formatCurrencyForLog(previousProduct.unitPriceInr)} -> ${formatCurrencyForLog(nextProduct.unitPriceInr)}`,
    );
  }
  if (previousProduct.imageUrl !== nextProduct.imageUrl) {
    changes.push("image updated");
  }

  return changes.length > 0 ? changes.join(", ") : "Saved without field changes.";
}

async function getProductForMutation(client, id) {
  const result = await client.query(
    `
      select
        products.id,
        products.code,
        products.name,
        categories.name as category,
        products.stock_quantity,
        products.unit_price_inr,
        products.image_url
      from products
      join categories on categories.id = products.category_id
      where products.id = $1
    `,
    [id],
  );

  return result.rows[0] ? normalizeProduct(result.rows[0]) : null;
}

async function attachOrderItems(client, orders) {
  if (orders.length === 0) {
    return orders;
  }

  const orderIds = orders.map((order) => order.id);
  const itemsResult = await client.query(
    `
      select
        order_items.id,
        order_items.order_id,
        order_items.quantity,
        order_items.unit_price_inr,
        products.id as product_id,
        products.code as product_code,
        products.name as product_name
      from order_items
      join products on products.id = order_items.product_id
      where order_items.order_id = any($1::bigint[])
      order by order_items.order_id desc, order_items.id asc
    `,
    [orderIds],
  );

  const itemsByOrderId = new Map();

  for (const row of itemsResult.rows) {
    const normalizedItem = {
      id: row.id,
      productId: row.product_id,
      productCode: row.product_code,
      productName: row.product_name,
      quantity: Number(row.quantity),
      unitPriceInr: Number(row.unit_price_inr),
      lineTotalInr: Number(row.quantity) * Number(row.unit_price_inr),
    };

    const existingItems = itemsByOrderId.get(row.order_id) || [];
    existingItems.push(normalizedItem);
    itemsByOrderId.set(row.order_id, existingItems);
  }

  return orders.map((order) => ({
    ...order,
    items: itemsByOrderId.get(order.id) || [],
  }));
}

async function ensureSetup() {
  if (!hasDatabaseConfig()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!setupPromise) {
    setupPromise = withClient(async (client) => {
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
          create table if not exists orders (
            id bigserial primary key,
            order_id text not null unique,
            customer_name text not null,
            customer_phone text,
            notes text,
            status text not null default 'pending_confirmation',
            payment_status text not null default 'pending',
            total_amount_inr numeric(12, 2) not null default 0,
            confirmed_at timestamptz,
            created_at timestamptz not null default now(),
            updated_at timestamptz not null default now()
          );
        `);

        await client.query(`
          create table if not exists order_items (
            id bigserial primary key,
            order_id bigint not null references orders(id) on delete cascade,
            product_id bigint not null references products(id) on delete restrict,
            quantity integer not null check (quantity > 0),
            unit_price_inr numeric(12, 2) not null default 0,
            created_at timestamptz not null default now()
          );
        `);

        await client.query(`
          create table if not exists inventory_activity_logs (
            id bigserial primary key,
            action text not null,
            product_id bigint references products(id) on delete set null,
            product_code text,
            product_name text,
            details text not null,
            created_at timestamptz not null default now()
          );
        `);

        const categories = deriveCategories(sampleProducts);
        for (const category of categories) {
          await client.query(
            `
              insert into categories (name, slug)
              values ($1, $2)
              on conflict (name)
              do update set slug = excluded.slug
            `,
            [category.name, category.slug],
          );
        }

        const productCountResult = await client.query("select count(*)::int as count from products");
        if (productCountResult.rows[0].count === 0) {
          for (const product of sampleProducts) {
            const categoryResult = await client.query(
              "select id from categories where name = $1",
              [product.category],
            );

            await client.query(
              `
                insert into products (code, name, category_id, stock_quantity, unit_price_inr, image_url)
                values ($1, $2, $3, $4, $5, $6)
              `,
              [
                product.code,
                product.name,
                categoryResult.rows[0].id,
                product.stockQuantity,
                product.unitPriceInr,
                product.imageUrl,
              ],
            );
          }
        }

        const admin = defaultAdminConfig();
        const adminResult = await client.query(
          `
            select id, password_hash
            from admin_users
            where username = $1
          `,
          [admin.username],
        );

        if (adminResult.rowCount === 0) {
          await client.query(
            `
              insert into admin_users (username, password_hash, display_name)
              values ($1, $2, $3)
            `,
            [admin.username, hashPassword(admin.password), admin.displayName],
          );
        } else if (!verifyPassword(admin.password, adminResult.rows[0].password_hash)) {
          await client.query(
            `
              update admin_users
              set password_hash = $2,
                  display_name = $3,
                  updated_at = now()
              where username = $1
            `,
            [admin.username, hashPassword(admin.password), admin.displayName],
          );
        }

        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    });
  }

  return setupPromise;
}

async function upsertCategory(client, categoryName) {
  const normalizedName = categoryName?.trim() || "General";
  const slug = slugifyCategory(normalizedName);
  const result = await client.query(
    `
      insert into categories (name, slug)
      values ($1, $2)
      on conflict (name)
      do update set slug = excluded.slug
      returning id, name, slug
    `,
    [normalizedName, slug],
  );

  return result.rows[0];
}

export async function listProducts({ admin = false } = {}) {
  await ensureSetup();

  return withClient(async (client) => {
    const result = await client.query(`
      select
        products.id,
        products.code,
        products.name,
        categories.name as category,
        products.stock_quantity,
        products.unit_price_inr,
        products.image_url
      from products
      join categories on categories.id = products.category_id
      order by products.name asc
    `);

    return result.rows.map(normalizeProduct).map((product) =>
      admin
        ? product
        : {
            id: product.id,
            code: product.code,
            name: product.name,
            category: product.category,
            stockQuantity: product.stockQuantity,
            unitPriceInr: product.unitPriceInr,
            imageUrl: product.imageUrl,
          },
    );
  });
}

export async function listCategories() {
  await ensureSetup();

  return withClient(async (client) => {
    const result = await client.query(`
      select id, name, slug
      from categories
      order by name asc
    `);

    return result.rows;
  });
}

export async function listRecentOrders(limit = 12) {
  await ensureSetup();

  return withClient(async (client) => {
    const result = await client.query(
      `
        select
          orders.*,
          count(order_items.id)::int as item_count,
          coalesce(sum(order_items.quantity), 0)::int as total_quantity
        from orders
        left join order_items on order_items.order_id = orders.id
        group by orders.id
        order by orders.created_at desc
        limit $1
      `,
      [limit],
    );

    const orders = result.rows.map(normalizeOrderHistoryRow);
    return attachOrderItems(client, orders);
  });
}

export async function listInventoryLogs(limit = 16) {
  await ensureSetup();

  return withClient(async (client) => {
    const result = await client.query(
      `
        select
          id,
          action,
          product_id,
          product_code,
          product_name,
          details,
          created_at
        from inventory_activity_logs
        order by created_at desc
        limit $1
      `,
      [limit],
    );

    return result.rows.map(normalizeInventoryLog);
  });
}

export async function getAdminDashboardSnapshot() {
  const [products, categories, recentOrders, inventoryLogs] = await Promise.all([
    listProducts({ admin: true }),
    listCategories(),
    listRecentOrders(),
    listInventoryLogs(),
  ]);

  return {
    products,
    categories,
    recentOrders,
    inventoryLogs,
  };
}

export async function authenticateAdmin(username, password) {
  await ensureSetup();

  return withClient(async (client) => {
    const result = await client.query(
      `
        select id, username, display_name, password_hash
        from admin_users
        where username = $1
      `,
      [username],
    );

    const admin = result.rows[0];
    if (!admin || !verifyPassword(password, admin.password_hash)) {
      return null;
    }

    return admin;
  });
}

function validateProductInput(payload) {
  if (!payload.code?.trim()) {
    throw new Error("Product code is required.");
  }
  if (!payload.name?.trim()) {
    throw new Error("Product name is required.");
  }
  if (!payload.category?.trim()) {
    throw new Error("Category is required.");
  }
  if (!Number.isFinite(payload.stockQuantity) || payload.stockQuantity < 0) {
    throw new Error("Stock quantity must be a non-negative number.");
  }
  if (!Number.isFinite(payload.unitPriceInr) || payload.unitPriceInr < 0) {
    throw new Error("Price must be a non-negative number.");
  }
  if (!payload.imageUrl?.trim()) {
    throw new Error("Image URL is required.");
  }
}

function validateOrderInput(payload) {
  if (!payload.customerName?.trim()) {
    throw new Error("Customer name is required.");
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error("At least one item is required.");
  }

  for (const item of payload.items) {
    if (!Number.isFinite(Number(item.productId))) {
      throw new Error("Invalid product in order.");
    }
    if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) {
      throw new Error("Quantity must be greater than zero.");
    }
  }
}

export async function createProduct(payload) {
  validateProductInput(payload);

  await ensureSetup();

  return withClient(async (client) => {
    await client.query("begin");

    try {
      const category = await upsertCategory(client, payload.category);
      const result = await client.query(
        `
          insert into products (code, name, category_id, stock_quantity, unit_price_inr, image_url)
          values ($1, $2, $3, $4, $5, $6)
          returning id
        `,
        [
          payload.code.trim(),
          payload.name.trim(),
          category.id,
          payload.stockQuantity,
          payload.unitPriceInr,
          payload.imageUrl.trim(),
        ],
      );

      await insertInventoryLog(client, {
        action: "product_created",
        productId: result.rows[0].id,
        productCode: payload.code.trim(),
        productName: payload.name.trim(),
        details: `Created in ${payload.category.trim()} with stock ${payload.stockQuantity} at ${formatCurrencyForLog(payload.unitPriceInr)}.`,
      });

      await client.query("commit");
      return result.rows[0];
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}

export async function updateProduct(id, payload) {
  validateProductInput(payload);

  await ensureSetup();

  return withClient(async (client) => {
    await client.query("begin");

    try {
      const previousProduct = await getProductForMutation(client, id);
      if (!previousProduct) {
        throw new Error("Product not found.");
      }

      const category = await upsertCategory(client, payload.category);
      await client.query(
        `
          update products
          set code = $2,
              name = $3,
              category_id = $4,
              stock_quantity = $5,
              unit_price_inr = $6,
              image_url = $7,
              updated_at = now()
          where id = $1
        `,
        [
          id,
          payload.code.trim(),
          payload.name.trim(),
          category.id,
          payload.stockQuantity,
          payload.unitPriceInr,
          payload.imageUrl.trim(),
        ],
      );

      await insertInventoryLog(client, {
        action: "product_updated",
        productId: id,
        productCode: payload.code.trim(),
        productName: payload.name.trim(),
        details: describeProductChanges(previousProduct, {
          code: payload.code.trim(),
          name: payload.name.trim(),
          category: payload.category.trim(),
          stockQuantity: payload.stockQuantity,
          unitPriceInr: payload.unitPriceInr,
          imageUrl: payload.imageUrl.trim(),
        }),
      });

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}

export async function deleteProduct(id) {
  await ensureSetup();

  return withClient(async (client) => {
    await client.query("begin");

    try {
      const existingProduct = await getProductForMutation(client, id);

      if (!existingProduct) {
        throw new Error("Product not found.");
      }

      await client.query("delete from products where id = $1", [id]);

      await insertInventoryLog(client, {
        action: "product_deleted",
        productCode: existingProduct.code,
        productName: existingProduct.name,
        details: `Deleted from ${existingProduct.category}. Last stock was ${existingProduct.stockQuantity} at ${formatCurrencyForLog(existingProduct.unitPriceInr)}.`,
      });

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}

export async function importProducts(products) {
  await ensureSetup();

  return withClient(async (client) => {
    await client.query("begin");

    try {
      for (const product of products) {
        validateProductInput(product);
        const existingProductResult = await client.query(
          `
            select
              products.id,
              products.code,
              products.name,
              categories.name as category,
              products.stock_quantity,
              products.unit_price_inr,
              products.image_url
            from products
            join categories on categories.id = products.category_id
            where products.code = $1
          `,
          [product.code.trim()],
        );
        const category = await upsertCategory(client, product.category);

        const result = await client.query(
          `
            insert into products (code, name, category_id, stock_quantity, unit_price_inr, image_url)
            values ($1, $2, $3, $4, $5, $6)
            on conflict (code)
            do update set
              name = excluded.name,
              category_id = excluded.category_id,
              stock_quantity = excluded.stock_quantity,
              unit_price_inr = excluded.unit_price_inr,
              image_url = excluded.image_url,
              updated_at = now()
            returning id
          `,
          [
            product.code.trim(),
            product.name.trim(),
            category.id,
            product.stockQuantity,
            product.unitPriceInr,
            product.imageUrl.trim(),
          ],
        );

        const existingProduct = existingProductResult.rows[0]
          ? normalizeProduct(existingProductResult.rows[0])
          : null;

        await insertInventoryLog(client, {
          action: existingProduct ? "product_imported" : "product_created_from_import",
          productId: result.rows[0].id,
          productCode: product.code.trim(),
          productName: product.name.trim(),
          details: existingProduct
            ? `Imported from sheet. ${describeProductChanges(existingProduct, {
                code: product.code.trim(),
                name: product.name.trim(),
                category: product.category.trim(),
                stockQuantity: product.stockQuantity,
                unitPriceInr: product.unitPriceInr,
                imageUrl: product.imageUrl.trim(),
              })}`
            : `Imported new product in ${product.category.trim()} with stock ${product.stockQuantity} at ${formatCurrencyForLog(product.unitPriceInr)}.`,
        });
      }

      await insertInventoryLog(client, {
        action: "inventory_import_summary",
        details: `Imported ${products.length} product row${products.length === 1 ? "" : "s"} from spreadsheet.`,
      });

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}

export async function createPendingOrder(payload) {
  validateOrderInput(payload);

  await ensureSetup();

  return withClient(async (client) => {
    await client.query("begin");

    try {
      const productIds = payload.items.map((item) => Number(item.productId));
      const productsResult = await client.query(
        `
          select id, code, name, stock_quantity, unit_price_inr
          from products
          where id = any($1::bigint[])
        `,
        [productIds],
      );

      const productsById = new Map(productsResult.rows.map((row) => [Number(row.id), row]));
      const orderId = createOrderId();
      const normalizedItems = payload.items.map((item) => {
        const product = productsById.get(Number(item.productId));

        if (!product) {
          throw new Error("A selected product no longer exists.");
        }

        return {
          productId: Number(product.id),
          productCode: product.code,
          productName: product.name,
          quantity: Number(item.quantity),
          unitPriceInr: Number(product.unit_price_inr),
          lineTotalInr: Number(item.quantity) * Number(product.unit_price_inr),
        };
      });

      const totalAmountInr = normalizedItems.reduce(
        (sum, item) => sum + item.lineTotalInr,
        0,
      );

      const orderResult = await client.query(
        `
          insert into orders (
            order_id,
            customer_name,
            customer_phone,
            notes,
            status,
            payment_status,
            total_amount_inr
          )
          values ($1, $2, $3, $4, 'pending_confirmation', 'pending', $5)
          returning *
        `,
        [
          orderId,
          payload.customerName.trim(),
          payload.customerPhone?.trim() || null,
          payload.notes?.trim() || null,
          totalAmountInr,
        ],
      );

      for (const item of normalizedItems) {
        await client.query(
          `
            insert into order_items (order_id, product_id, quantity, unit_price_inr)
            values ($1, $2, $3, $4)
          `,
          [orderResult.rows[0].id, item.productId, item.quantity, item.unitPriceInr],
        );
      }

      await client.query("commit");

      return {
        ...normalizeOrder(orderResult.rows[0]),
        items: normalizedItems,
      };
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}

export async function getOrderByOrderId(orderId) {
  const normalizedOrderId = String(orderId || "").trim();

  if (!normalizedOrderId) {
    throw new Error("Order ID is required.");
  }

  await ensureSetup();

  return withClient(async (client) => {
    const orderResult = await client.query(
      `
        select *
        from orders
        where order_id = $1
      `,
      [normalizedOrderId],
    );

    const order = orderResult.rows[0];
    if (!order) {
      return null;
    }

    const itemsResult = await client.query(
      `
        select
          order_items.id,
          order_items.quantity,
          order_items.unit_price_inr,
          products.id as product_id,
          products.code as product_code,
          products.name as product_name
        from order_items
        join products on products.id = order_items.product_id
        where order_items.order_id = $1
        order by order_items.id asc
      `,
      [order.id],
    );

    return {
      ...normalizeOrder(order),
      items: itemsResult.rows.map((item) => ({
        id: item.id,
        productId: item.product_id,
        productCode: item.product_code,
        productName: item.product_name,
        quantity: Number(item.quantity),
        unitPriceInr: Number(item.unit_price_inr),
        lineTotalInr: Number(item.quantity) * Number(item.unit_price_inr),
      })),
    };
  });
}

export async function confirmOrder(orderId) {
  const normalizedOrderId = String(orderId || "").trim();

  if (!normalizedOrderId) {
    throw new Error("Order ID is required.");
  }

  await ensureSetup();

  return withClient(async (client) => {
    await client.query("begin");

    try {
      const orderResult = await client.query(
        `
          select *
          from orders
          where order_id = $1
          for update
        `,
        [normalizedOrderId],
      );

      const order = orderResult.rows[0];
      if (!order) {
        throw new Error("Order not found.");
      }

      const itemsResult = await client.query(
        `
          select
            order_items.quantity,
            order_items.unit_price_inr,
            products.id as product_id,
            products.code as product_code,
            products.name as product_name,
            products.stock_quantity
          from order_items
          join products on products.id = order_items.product_id
          where order_items.order_id = $1
          for update of products
        `,
        [order.id],
      );

      const items = itemsResult.rows.map((item) => ({
        productId: item.product_id,
        productCode: item.product_code,
        productName: item.product_name,
        quantity: Number(item.quantity),
        unitPriceInr: Number(item.unit_price_inr),
        lineTotalInr: Number(item.quantity) * Number(item.unit_price_inr),
        stockQuantity: Number(item.stock_quantity),
      }));

      if (order.status !== "confirmed") {
        for (const item of items) {
          if (item.stockQuantity < item.quantity) {
            throw new Error(`Not enough stock for ${item.productName}.`);
          }
        }

        for (const item of items) {
          await client.query(
            `
              update products
              set stock_quantity = stock_quantity - $2,
                  updated_at = now()
              where id = $1
            `,
            [item.productId, item.quantity],
          );

          await insertInventoryLog(client, {
            action: "stock_deducted_from_order",
            productId: item.productId,
            productCode: item.productCode,
            productName: item.productName,
            details: `Deducted ${item.quantity} units after confirming order ${normalizedOrderId}.`,
          });
        }

        await client.query(
          `
            update orders
            set status = 'confirmed',
                payment_status = 'confirmed',
                confirmed_at = now(),
                updated_at = now()
            where id = $1
          `,
          [order.id],
        );

        await insertInventoryLog(client, {
          action: "order_confirmed",
          details: `Confirmed order ${normalizedOrderId} for ${order.customer_name} totaling ${formatCurrencyForLog(order.total_amount_inr)} with ${items.length} item${items.length === 1 ? "" : "s"}.`,
        });
      }

      await client.query("commit");

      return await getOrderByOrderId(normalizedOrderId);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}

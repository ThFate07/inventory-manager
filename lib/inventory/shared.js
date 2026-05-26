import { withClient } from "../db.js";
import { deleteBlobUrl, isManagedBlobUrl } from "../blob.js";

export function getProductImageUrl(row, { proxyImages = false } = {}) {
  const rawImageUrl = row.image_url || "";

  if (proxyImages && rawImageUrl.startsWith("data:") && row.id != null) {
    return `/api/products/${row.id}/image`;
  }

  return rawImageUrl;
}

export function normalizeProduct(row, { proxyImages = false } = {}) {
  const orderReferenceCount = Number(row.order_reference_count || 0);

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    ctn: row.ctn || "",
    qtyPerCtn: row.qty_per_ctn || "",
    catalogUnit: row.catalog_unit || "1 pcs",
    stockQuantity: Number(row.stock_quantity),
    unitPriceInr: Number(row.unit_price_inr),
    imageUrl: getProductImageUrl(row, { proxyImages }),
    orderReferenceCount,
    canDelete: orderReferenceCount === 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPublicProduct(product) {
  return {
    id: product.id,
    code: product.code,
    name: product.name,
    category: product.category,
    ctn: product.ctn,
    qtyPerCtn: product.qtyPerCtn,
    catalogUnit: product.catalogUnit,
    stockQuantity: product.stockQuantity,
    unitPriceInr: product.unitPriceInr,
    imageUrl: product.imageUrl,
  };
}

export function createOrderId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `ORD-${timestamp}-${randomPart}`;
}

export function normalizeOrder(row) {
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

export function normalizeOrderItemRow(row) {
  return {
    id: row.id,
    productId: row.product_id,
    productCode: row.product_code,
    productName: row.product_name,
    category: row.category || "",
    ctn: row.ctn || "",
    qtyPerCtn: row.qty_per_ctn || "",
    imageUrl: row.image_url || "",
    quantity: Number(row.quantity),
    unitPriceInr: Number(row.unit_price_inr),
    lineTotalInr: Number(row.quantity) * Number(row.unit_price_inr),
    stockQuantity:
      row.stock_quantity == null ? null : Number(row.stock_quantity),
  };
}

export function normalizeInventoryLog(row) {
  return {
    id: row.id,
    action: row.action,
    productId: row.product_id,
    productCode: row.product_code,
    productName: row.product_name,
    category: row.category || "",
    details: row.details,
    createdAt: row.created_at,
  };
}

export function normalizeOrderHistoryRow(row) {
  return {
    ...normalizeOrder(row),
    itemCount: Number(row.item_count || 0),
    totalQuantity: Number(row.total_quantity || 0),
    items: [],
  };
}

export function formatCurrencyForLog(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

export function normalizeOptionalText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeProductCode(value) {
  return normalizeOptionalText(value).replace(/\s+/g, "");
}

export function buildProductVariantIdentity(product) {
  return {
    code: normalizeProductCode(product.code),
    ctn: normalizeOptionalText(product.ctn),
    qtyPerCtn: normalizeOptionalText(product.qtyPerCtn),
    catalogUnit: normalizeOptionalText(product.catalogUnit) || "1 pcs",
  };
}

export async function deleteOrphanedManagedBlobUrls(urls = []) {
  const uniqueManagedUrls = [
    ...new Set(urls.filter((url) => isManagedBlobUrl(url))),
  ];

  if (uniqueManagedUrls.length === 0) {
    return;
  }

  const orphanedUrls = await withClient(async (client) => {
    const result = await client.query(
      `
        select image_url
        from products
        where image_url = any($1::text[])
      `,
      [uniqueManagedUrls],
    );

    const stillReferenced = new Set(result.rows.map((row) => row.image_url));
    return uniqueManagedUrls.filter((url) => !stillReferenced.has(url));
  });

  if (orphanedUrls.length > 0) {
    await Promise.allSettled(orphanedUrls.map((url) => deleteBlobUrl(url)));
  }
}

export async function insertInventoryLog(client, entry) {
  await client.query(
    `
      insert into inventory_activity_logs (
        action,
        product_id,
        product_code,
        product_name,
        category,
        details
      )
      values ($1, $2, $3, $4, $5, $6)
    `,
    [
      entry.action,
      entry.productId ?? null,
      entry.productCode ?? null,
      entry.productName ?? null,
      entry.category ?? null,
      entry.details,
    ],
  );
}

export function describeProductChanges(previousProduct, nextProduct) {
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
  if (previousProduct.ctn !== nextProduct.ctn) {
    changes.push(`ctn ${previousProduct.ctn || "empty"} -> ${nextProduct.ctn || "empty"}`);
  }
  if (previousProduct.qtyPerCtn !== nextProduct.qtyPerCtn) {
    changes.push(
      `qty/ctn ${previousProduct.qtyPerCtn || "empty"} -> ${nextProduct.qtyPerCtn || "empty"}`,
    );
  }
  if (previousProduct.catalogUnit !== nextProduct.catalogUnit) {
    changes.push(`catalog unit ${previousProduct.catalogUnit} -> ${nextProduct.catalogUnit}`);
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

export function calculateOrderTotal(items) {
  return items.reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.unitPriceInr),
    0,
  );
}

export function requireOrderId(orderId) {
  const normalizedOrderId = String(orderId || "").trim();

  if (!normalizedOrderId) {
    throw new Error("Order ID is required.");
  }

  return normalizedOrderId;
}

export async function withTransaction(work) {
  return withClient(async (client) => {
    await client.query("begin");

    try {
      const result = await work(client);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}

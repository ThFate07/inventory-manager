import { withClient } from "../db.js";
import { isManagedBlobUrl } from "../blob.js";
import { upsertCategory } from "./categories.js";
import {
  buildProductVariantIdentity,
  deleteOrphanedManagedBlobUrls,
  describeProductChanges,
  formatCurrencyForLog,
  insertInventoryLog,
  normalizeOptionalText,
  normalizeProduct,
  normalizeProductCode,
  toPublicProduct,
  withTransaction,
} from "./shared.js";

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
  if (payload.ctn != null && typeof payload.ctn !== "string") {
    throw new Error("CTN must be text.");
  }
  if (payload.qtyPerCtn != null && typeof payload.qtyPerCtn !== "string") {
    throw new Error("QTY/CTN must be text.");
  }
  if (!payload.catalogUnit?.trim()) {
    throw new Error("FOR value is required.");
  }
  if (!Number.isFinite(payload.stockQuantity) || payload.stockQuantity < 0) {
    throw new Error("Stock quantity must be a non-negative number.");
  }
  if (!Number.isFinite(payload.unitPriceInr) || payload.unitPriceInr < 0) {
    throw new Error("Price must be a non-negative number.");
  }
}

async function getProductForMutation(client, id) {
  const result = await client.query(
    `
      select
        products.id,
        products.code,
        products.name,
        categories.name as category,
        products.ctn,
        products.qty_per_ctn,
        products.catalog_unit,
        products.stock_quantity,
        products.unit_price_inr,
        products.image_url,
        products.created_at,
        products.updated_at
      from products
      join categories on categories.id = products.category_id
      where products.id = $1
    `,
    [id],
  );

  return result.rows[0] ? normalizeProduct(result.rows[0]) : null;
}

async function findProductIdForImportMerge(client, product) {
  const result = await client.query(
    `
      select id
      from products
      where code = $1
        and qty_per_ctn = $2
        and unit_price_inr = $3
      order by id asc
      limit 1
    `,
    [
      normalizeProductCode(product.code),
      normalizeOptionalText(product.qtyPerCtn),
      product.unitPriceInr,
    ],
  );

  return result.rows[0] ? Number(result.rows[0].id) : null;
}

function buildSavedProductDetails(payload, imageUrl, productCode) {
  return {
    code: productCode,
    name: payload.name.trim(),
    category: payload.category.trim(),
    ctn: normalizeOptionalText(payload.ctn),
    qtyPerCtn: normalizeOptionalText(payload.qtyPerCtn),
    catalogUnit: payload.catalogUnit.trim(),
    stockQuantity: payload.stockQuantity,
    unitPriceInr: payload.unitPriceInr,
    imageUrl,
  };
}

export async function listProducts({ admin = false, proxyImages = !admin } = {}) {
  return withClient(async (client) => {
    const result = await client.query(`
      select
        products.id,
        products.code,
        products.name,
        categories.name as category,
        products.ctn,
        products.qty_per_ctn,
        products.catalog_unit,
        products.stock_quantity,
        products.unit_price_inr,
        products.image_url,
        count(order_items.id)::int as order_reference_count,
        products.created_at,
        products.updated_at
      from products
      join categories on categories.id = products.category_id
      left join order_items on order_items.product_id = products.id
      group by products.id, categories.name
      order by products.name asc
    `);

    const products = result.rows.map((row) =>
      normalizeProduct(row, { proxyImages }),
    );

    return admin ? products : products.map(toPublicProduct);
  });
}

export async function getProductImageAsset(id) {
  return withClient(async (client) => {
    const result = await client.query(
      `
        select id, image_url
        from products
        where id = $1
      `,
      [id],
    );

    const row = result.rows[0];

    if (!row?.image_url) {
      return null;
    }

    return {
      id: Number(row.id),
      imageUrl: row.image_url,
    };
  });
}

export async function createProduct(payload) {
  validateProductInput(payload);
  const imageUrl = normalizeOptionalText(payload.imageUrl);
  const productCode = normalizeProductCode(payload.code);

  return withTransaction(async (client) => {
    const category = await upsertCategory(client, payload.category);
    const result = await client.query(
      `
        insert into products (code, name, category_id, ctn, qty_per_ctn, catalog_unit, stock_quantity, unit_price_inr, image_url)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        returning id
      `,
      [
        productCode,
        payload.name.trim(),
        category.id,
        normalizeOptionalText(payload.ctn),
        normalizeOptionalText(payload.qtyPerCtn),
        payload.catalogUnit.trim(),
        payload.stockQuantity,
        payload.unitPriceInr,
        imageUrl,
      ],
    );

    await insertInventoryLog(client, {
      action: "product_created",
      productId: result.rows[0].id,
      productCode,
      productName: payload.name.trim(),
      category: payload.category.trim(),
      details: `Created in ${payload.category.trim()} with stock ${payload.stockQuantity} at ${formatCurrencyForLog(payload.unitPriceInr)}.`,
    });

    return result.rows[0];
  });
}

export async function updateProduct(id, payload) {
  validateProductInput(payload);
  const imageUrl = normalizeOptionalText(payload.imageUrl);
  const productCode = normalizeProductCode(payload.code);
  let previousImageUrlToDelete = "";

  await withTransaction(async (client) => {
    const previousProduct = await getProductForMutation(client, id);
    if (!previousProduct) {
      throw new Error("Product not found.");
    }

    const category = await upsertCategory(client, payload.category);
    const nextProduct = buildSavedProductDetails(payload, imageUrl, productCode);

    await client.query(
      `
        update products
        set code = $2,
            name = $3,
            category_id = $4,
            ctn = $5,
            qty_per_ctn = $6,
            catalog_unit = $7,
            stock_quantity = $8,
            unit_price_inr = $9,
            image_url = $10,
            updated_at = now()
        where id = $1
      `,
      [
        id,
        productCode,
        payload.name.trim(),
        category.id,
        nextProduct.ctn,
        nextProduct.qtyPerCtn,
        nextProduct.catalogUnit,
        payload.stockQuantity,
        payload.unitPriceInr,
        imageUrl,
      ],
    );

    await insertInventoryLog(client, {
      action: "product_updated",
      productId: id,
      productCode,
      productName: payload.name.trim(),
      category: payload.category.trim(),
      details: describeProductChanges(previousProduct, nextProduct),
    });

    if (
      previousProduct.imageUrl &&
      previousProduct.imageUrl !== imageUrl &&
      isManagedBlobUrl(previousProduct.imageUrl)
    ) {
      previousImageUrlToDelete = previousProduct.imageUrl;
    }
  });

  if (previousImageUrlToDelete) {
    await deleteOrphanedManagedBlobUrls([previousImageUrlToDelete]);
  }
}

export async function deleteProduct(id) {
  let imageUrlToDelete = "";

  await withTransaction(async (client) => {
    const existingProduct = await getProductForMutation(client, id);

    if (!existingProduct) {
      throw new Error("Product not found.");
    }

    await client.query("delete from products where id = $1", [id]);

    await insertInventoryLog(client, {
      action: "product_deleted",
      productCode: existingProduct.code,
      productName: existingProduct.name,
      category: existingProduct.category,
      details: `Deleted from ${existingProduct.category}. Last stock was ${existingProduct.stockQuantity} at ${formatCurrencyForLog(existingProduct.unitPriceInr)}.`,
    });

    if (isManagedBlobUrl(existingProduct.imageUrl)) {
      imageUrlToDelete = existingProduct.imageUrl;
    }
  });

  if (imageUrlToDelete) {
    await deleteOrphanedManagedBlobUrls([imageUrlToDelete]);
  }
}

export async function clearAllProducts() {
  const blobUrlsToDelete = new Set();

  const result = await withTransaction(async (client) => {
    const referencedProductsResult = await client.query(
      `
        select
          products.code,
          products.name
        from products
        where exists (
          select 1
          from order_items
          where order_items.product_id = products.id
        )
        order by products.name asc
        limit 5
      `,
    );

    if (referencedProductsResult.rowCount > 0) {
      const preview = referencedProductsResult.rows
        .map((row) => `${row.code} (${row.name})`)
        .join(", ");

      throw new Error(
        `Some products are used in existing orders and cannot be cleared. Remove those order references first. Example: ${preview}.`,
      );
    }

    const existingProductsResult = await client.query(
      `
        select id, image_url
        from products
      `,
    );
    const deletedCount = existingProductsResult.rowCount;

    for (const row of existingProductsResult.rows) {
      if (isManagedBlobUrl(row.image_url)) {
        blobUrlsToDelete.add(row.image_url);
      }
    }

    await client.query("delete from products");

    await client.query(
      `
        delete from categories
        where not exists (
          select 1
          from products
          where products.category_id = categories.id
        )
      `,
    );

    await insertInventoryLog(client, {
      action: "products_cleared",
      details: `Cleared ${deletedCount} product${deletedCount === 1 ? "" : "s"} from inventory.`,
    });

    return { deletedCount };
  });

  if (blobUrlsToDelete.size > 0) {
    await deleteOrphanedManagedBlobUrls(Array.from(blobUrlsToDelete));
  }

  return result;
}

export async function importProducts(products, importReport = {}, options = {}) {
  const blobUrlsToDelete = new Set();
  const report = {
    succeededCount: 0,
    createdCount: 0,
    updatedCount: 0,
    failedProducts: [],
    attemptedCount: Array.isArray(products) ? products.length : 0,
  };

  const importMode = options.importMode === "images-only" ? "images-only" : "sheet";
  const logUnmatched = options.logUnmatched !== false;
  const logSummary = options.logSummary !== false;
  const summaryProductCount =
    Number.isFinite(Number(options.summaryProductCount)) &&
    Number(options.summaryProductCount) >= 0
      ? Number(options.summaryProductCount)
      : products.length;

  for (const [index, product] of products.entries()) {
    try {
      validateProductInput(product);

      await withTransaction(async (client) => {
        const variantIdentity = buildProductVariantIdentity(product);
        const category = await upsertCategory(client, product.category);
        const targetProductId = Number(product.id);
        let existingProduct = null;

        if (importMode === "images-only" && Number.isFinite(targetProductId)) {
          existingProduct = await getProductForMutation(client, targetProductId);

          if (!existingProduct) {
            throw new Error(`Product ${targetProductId} was not found for image import.`);
          }
        } else if (importMode === "sheet") {
          const existingProductId = await findProductIdForImportMerge(client, product);

          if (existingProductId != null) {
            existingProduct = await getProductForMutation(client, existingProductId);
          }
        }

        const imageUrl =
          normalizeOptionalText(product.imageUrl) || existingProduct?.imageUrl || "";
        const nextStockQuantity =
          existingProduct && importMode === "sheet"
            ? Number(existingProduct.stockQuantity) + Number(product.stockQuantity)
            : product.stockQuantity;
        const savedProductDetails = {
          code: variantIdentity.code,
          name: product.name.trim(),
          category: product.category.trim(),
          ctn: variantIdentity.ctn,
          qtyPerCtn: variantIdentity.qtyPerCtn,
          catalogUnit: variantIdentity.catalogUnit,
          stockQuantity: nextStockQuantity,
          unitPriceInr: product.unitPriceInr,
          imageUrl,
        };
        let productId;
        const didUpdateExistingProduct = Boolean(existingProduct);

        if (existingProduct) {
          await client.query(
            `
              update products
              set name = $2,
                  category_id = $3,
                  ctn = $4,
                  qty_per_ctn = $5,
                  catalog_unit = $6,
                  stock_quantity = $7,
                  unit_price_inr = $8,
                  image_url = $9,
                  updated_at = now()
              where id = $1
            `,
            [
              existingProduct.id,
              product.name.trim(),
              category.id,
              variantIdentity.ctn,
              variantIdentity.qtyPerCtn,
              variantIdentity.catalogUnit,
              nextStockQuantity,
              product.unitPriceInr,
              imageUrl,
            ],
          );
          productId = existingProduct.id;

          if (
            existingProduct.imageUrl &&
            existingProduct.imageUrl !== imageUrl &&
            isManagedBlobUrl(existingProduct.imageUrl)
          ) {
            blobUrlsToDelete.add(existingProduct.imageUrl);
          }
        } else {
          const result = await client.query(
            `
              insert into products (code, name, category_id, ctn, qty_per_ctn, catalog_unit, stock_quantity, unit_price_inr, image_url)
              values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              returning id
            `,
            [
              variantIdentity.code,
              product.name.trim(),
              category.id,
              variantIdentity.ctn,
              variantIdentity.qtyPerCtn,
              variantIdentity.catalogUnit,
              product.stockQuantity,
              product.unitPriceInr,
              imageUrl,
            ],
          );
          productId = result.rows[0].id;
        }

        await insertInventoryLog(client, {
          action: didUpdateExistingProduct ? "product_imported" : "product_created_from_import",
          productId,
          productCode: variantIdentity.code,
          productName: product.name.trim(),
          category: product.category.trim(),
          details: didUpdateExistingProduct
            ? `Imported from sheet. Added ${product.stockQuantity} stock to existing ${existingProduct.stockQuantity}, new total ${nextStockQuantity}. ${describeProductChanges(existingProduct, savedProductDetails)}`
            : `Imported new product in ${product.category.trim()} with stock ${product.stockQuantity} at ${formatCurrencyForLog(product.unitPriceInr)}.`,
        });

        report.succeededCount += 1;
        if (didUpdateExistingProduct) {
          report.updatedCount += 1;
        } else {
          report.createdCount += 1;
        }
      });
    } catch (error) {
      report.failedProducts.push({
        index,
        code: product?.code ?? "",
        name: product?.name ?? "",
        category: product?.category ?? "",
        message: error instanceof Error && error.message ? error.message : "Unable to import product.",
      });
    }
  }

  if (logUnmatched && report.succeededCount > 0) {
    await withTransaction(async (client) => {
      for (const unmatchedProduct of importReport.unmatchedProducts || []) {
        await insertInventoryLog(client, {
          action: "import_image_unmatched_product",
          productCode: unmatchedProduct.code,
          productName: unmatchedProduct.name,
          category: unmatchedProduct.category || null,
          details: "Imported row did not get a matching uploaded image.",
        });
      }

      for (const unmatchedImageFile of importReport.unmatchedImages || []) {
        await insertInventoryLog(client, {
          action: "import_image_unmatched_file",
          productCode: unmatchedImageFile,
          productName: "Unmatched uploaded image",
          details: `Uploaded image "${unmatchedImageFile}" did not match any imported row.`,
        });
      }
    });
  }

  if (logSummary && report.succeededCount > 0) {
    await withTransaction(async (client) => {
      await insertInventoryLog(client, {
        action: "inventory_import_summary",
        details: `Imported ${summaryProductCount} product row${summaryProductCount === 1 ? "" : "s"} from spreadsheet. Successful: ${report.succeededCount}. Failed: ${report.failedProducts.length}. Unmatched products: ${(importReport.unmatchedProducts || []).length}. Unmatched images: ${(importReport.unmatchedImages || []).length}.`,
      });
    });
  }

  if (blobUrlsToDelete.size > 0) {
    await deleteOrphanedManagedBlobUrls(Array.from(blobUrlsToDelete));
  }

  return report;
}

import { withClient } from "../db.js";
import {
  calculateOrderTotal,
  createOrderId,
  formatCurrencyForLog,
  insertInventoryLog,
  normalizeOrder,
  normalizeOrderHistoryRow,
  normalizeOrderItemRow,
  requireOrderId,
  withTransaction,
} from "./shared.js";

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

function normalizeRequestedOrderItems(items) {
  const mergedItems = new Map();

  for (const item of Array.isArray(items) ? items : []) {
    const productId = Number(item?.productId);
    const quantity = Number(item?.quantity);

    if (!Number.isFinite(productId) || !Number.isFinite(quantity)) {
      continue;
    }

    mergedItems.set(productId, (mergedItems.get(productId) || 0) + quantity);
  }

  return [...mergedItems.entries()].map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
}

function validateOrderConfirmationOverrides(items) {
  if (items == null) {
    return [];
  }

  if (!Array.isArray(items)) {
    throw new Error("Updated order items must be an array.");
  }

  const seenIds = new Set();

  return items.map((item) => {
    const itemId = Number(item?.id);
    const unitPriceInr = Number(item?.unitPriceInr);

    if (!Number.isFinite(itemId)) {
      throw new Error("Each updated order item must include a valid item ID.");
    }

    if (seenIds.has(itemId)) {
      throw new Error("Duplicate order item updates are not allowed.");
    }

    if (!Number.isFinite(unitPriceInr) || unitPriceInr < 0) {
      throw new Error("Unit price must be a non-negative number.");
    }

    seenIds.add(itemId);

    return {
      id: itemId,
      unitPriceInr,
    };
  });
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
        order_items.product_id,
        order_items.quantity,
        order_items.unit_price_inr,
        coalesce(order_items.product_code, products.code, '') as product_code,
        coalesce(order_items.product_name, products.name, '') as product_name,
        coalesce(order_items.category, categories.name, '') as category,
        coalesce(order_items.ctn, products.ctn, '') as ctn,
        coalesce(order_items.qty_per_ctn, products.qty_per_ctn, '') as qty_per_ctn,
        coalesce(order_items.image_url, products.image_url, '') as image_url
      from order_items
      left join products on products.id = order_items.product_id
      left join categories on categories.id = products.category_id
      where order_items.order_id = any($1::bigint[])
      order by order_items.order_id desc, order_items.id asc
    `,
    [orderIds],
  );

  const itemsByOrderId = new Map();

  for (const row of itemsResult.rows) {
    const normalizedItem = normalizeOrderItemRow(row);
    const existingItems = itemsByOrderId.get(row.order_id) || [];

    existingItems.push(normalizedItem);
    itemsByOrderId.set(row.order_id, existingItems);
  }

  return orders.map((order) => ({
    ...order,
    items: itemsByOrderId.get(order.id) || [],
  }));
}

async function getOrderItemsForMutation(client, orderDbId) {
  const itemsResult = await client.query(
    `
      select
        order_items.id,
        order_items.product_id,
        order_items.quantity,
        order_items.unit_price_inr,
        coalesce(order_items.product_code, products.code, '') as product_code,
        coalesce(order_items.product_name, products.name, '') as product_name,
        coalesce(order_items.category, categories.name, '') as category,
        coalesce(order_items.ctn, products.ctn, '') as ctn,
        coalesce(order_items.qty_per_ctn, products.qty_per_ctn, '') as qty_per_ctn,
        coalesce(order_items.image_url, products.image_url, '') as image_url,
        products.stock_quantity
      from order_items
      join products on products.id = order_items.product_id
      left join categories on categories.id = products.category_id
      where order_items.order_id = $1
      for update of order_items, products
    `,
    [orderDbId],
  );

  return itemsResult.rows.map(normalizeOrderItemRow);
}

async function restoreStockForOrder(client, orderLabel, items) {
  for (const item of items) {
    await client.query(
      `
        update products
        set stock_quantity = stock_quantity + $2,
            updated_at = now()
        where id = $1
      `,
      [item.productId, item.quantity],
    );

    await insertInventoryLog(client, {
      action: "stock_restored_from_order",
      productId: item.productId,
      productCode: item.productCode,
      productName: item.productName,
      category: item.category,
      details: `Restored ${item.quantity} units after reversing order ${orderLabel}.`,
    });
  }
}

async function fetchOrderRecordForUpdate(client, orderId) {
  const orderResult = await client.query(
    `
      select *
      from orders
      where order_id = $1
      for update
    `,
    [orderId],
  );

  return orderResult.rows[0];
}

async function fetchOrderByOrderIdWithItems(client, orderId) {
  const orderResult = await client.query(
    `
      select *
      from orders
      where order_id = $1
    `,
    [orderId],
  );

  const order = orderResult.rows[0];
  if (!order) {
    return null;
  }

  const itemsResult = await client.query(
    `
      select
        order_items.id,
        order_items.product_id,
        order_items.quantity,
        order_items.unit_price_inr,
        coalesce(order_items.product_code, products.code, '') as product_code,
        coalesce(order_items.product_name, products.name, '') as product_name,
        coalesce(order_items.category, categories.name, '') as category,
        coalesce(order_items.ctn, products.ctn, '') as ctn,
        coalesce(order_items.qty_per_ctn, products.qty_per_ctn, '') as qty_per_ctn,
        coalesce(order_items.image_url, products.image_url, '') as image_url
      from order_items
      left join products on products.id = order_items.product_id
      left join categories on categories.id = products.category_id
      where order_items.order_id = $1
      order by order_items.id asc
    `,
    [order.id],
  );

  return {
    ...normalizeOrder(order),
    items: itemsResult.rows.map(normalizeOrderItemRow),
  };
}

export async function listRecentOrders(limit = 12) {
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

export async function createPendingOrder(payload) {
  validateOrderInput(payload);

  return withTransaction(async (client) => {
    const requestedItems = normalizeRequestedOrderItems(payload.items);
    const productIds = requestedItems.map((item) => Number(item.productId));
    const productsResult = await client.query(
      `
        select
          products.id,
          products.code,
          products.name,
          products.ctn,
          products.qty_per_ctn,
          products.image_url,
          products.stock_quantity,
          products.unit_price_inr,
          categories.name as category
        from products
        join categories on categories.id = products.category_id
        where products.id = any($1::bigint[])
      `,
      [productIds],
    );

    const productsById = new Map(
      productsResult.rows.map((row) => [Number(row.id), row]),
    );
    const orderId = createOrderId();
    const normalizedItems = requestedItems.map((item) => {
      const product = productsById.get(Number(item.productId));

      if (!product) {
        throw new Error("A selected product no longer exists.");
      }

      return {
        productId: Number(product.id),
        productCode: product.code,
        productName: product.name,
        category: product.category || "",
        ctn: product.ctn || "",
        qtyPerCtn: product.qty_per_ctn || "",
        imageUrl: product.image_url || "",
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
          insert into order_items (
            order_id,
            product_id,
            product_code,
            product_name,
            category,
            ctn,
            qty_per_ctn,
            image_url,
            quantity,
            unit_price_inr
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        [
          orderResult.rows[0].id,
          item.productId,
          item.productCode,
          item.productName,
          item.category,
          item.ctn,
          item.qtyPerCtn,
          item.imageUrl,
          item.quantity,
          item.unitPriceInr,
        ],
      );
    }

    return {
      ...normalizeOrder(orderResult.rows[0]),
      items: normalizedItems,
    };
  });
}

export async function getOrderByOrderId(orderId) {
  const normalizedOrderId = requireOrderId(orderId);

  return withClient((client) => fetchOrderByOrderIdWithItems(client, normalizedOrderId));
}

export async function confirmOrder(orderId, payload = {}) {
  const normalizedOrderId = requireOrderId(orderId);

  return withTransaction(async (client) => {
    const order = await fetchOrderRecordForUpdate(client, normalizedOrderId);
    if (!order) {
      throw new Error("Order not found.");
    }

    let items = await getOrderItemsForMutation(client, order.id);
    const overrides = validateOrderConfirmationOverrides(payload.items);

    if (order.status === "confirmed" && overrides.length > 0) {
      throw new Error("Reverse the confirmed order before changing item prices.");
    }

    if (overrides.length > 0) {
      const overrideById = new Map(
        overrides.map((item) => [item.id, item.unitPriceInr]),
      );
      const itemIds = new Set(items.map((item) => Number(item.id)));

      for (const override of overrides) {
        if (!itemIds.has(override.id)) {
          throw new Error("One or more updated prices do not belong to this order.");
        }
      }

      for (const item of items) {
        if (!overrideById.has(item.id)) {
          continue;
        }

        const nextUnitPriceInr = overrideById.get(item.id);

        if (Number(item.unitPriceInr) === Number(nextUnitPriceInr)) {
          continue;
        }

        await client.query(
          `
            update order_items
            set unit_price_inr = $2
            where id = $1
          `,
          [item.id, nextUnitPriceInr],
        );
      }

      items = items.map((item) => {
        if (!overrideById.has(item.id)) {
          return item;
        }

        const unitPriceInr = overrideById.get(item.id);
        return {
          ...item,
          unitPriceInr,
          lineTotalInr: Number(item.quantity) * Number(unitPriceInr),
        };
      });

      await client.query(
        `
          update orders
          set total_amount_inr = $2,
              updated_at = now()
          where id = $1
        `,
        [order.id, calculateOrderTotal(items)],
      );
    }

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
          category: item.category,
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
        details: `Confirmed order ${normalizedOrderId} for ${order.customer_name} totaling ${formatCurrencyForLog(calculateOrderTotal(items))} with ${items.length} item${items.length === 1 ? "" : "s"}.`,
      });
    }

    return fetchOrderByOrderIdWithItems(client, normalizedOrderId);
  });
}

export async function reverseConfirmedOrder(orderId) {
  const normalizedOrderId = requireOrderId(orderId);

  return withTransaction(async (client) => {
    const order = await fetchOrderRecordForUpdate(client, normalizedOrderId);
    if (!order) {
      throw new Error("Order not found.");
    }

    if (order.status !== "confirmed") {
      throw new Error("Only confirmed orders can be reversed.");
    }

    const items = await getOrderItemsForMutation(client, order.id);
    await restoreStockForOrder(client, normalizedOrderId, items);

    await client.query(
      `
        update orders
        set status = 'pending_confirmation',
            payment_status = 'pending',
            confirmed_at = null,
            updated_at = now()
        where id = $1
      `,
      [order.id],
    );

    await insertInventoryLog(client, {
      action: "order_reversed",
      details: `Reversed confirmed order ${normalizedOrderId} for ${order.customer_name} and restored stock.`,
    });

    return fetchOrderByOrderIdWithItems(client, normalizedOrderId);
  });
}

export async function deleteOrder(orderId) {
  const normalizedOrderId = requireOrderId(orderId);

  return withTransaction(async (client) => {
    const order = await fetchOrderRecordForUpdate(client, normalizedOrderId);
    if (!order) {
      throw new Error("Order not found.");
    }

    const items = await getOrderItemsForMutation(client, order.id);

    if (order.status === "confirmed") {
      await restoreStockForOrder(client, normalizedOrderId, items);
    }

    await client.query("delete from orders where id = $1", [order.id]);

    await insertInventoryLog(client, {
      action: "order_deleted",
      details:
        order.status === "confirmed"
          ? `Deleted confirmed order ${normalizedOrderId} for ${order.customer_name} and restored stock before removal.`
          : `Deleted pending order ${normalizedOrderId} for ${order.customer_name}.`,
    });

    return {
      deletedOrderId: normalizedOrderId,
      restoredStock: order.status === "confirmed",
    };
  });
}

export async function clearAllOrders() {
  return withTransaction(async (client) => {
    const existingOrdersResult = await client.query(`
      select id, status
      from orders
      for update
    `);
    const deletedCount = existingOrdersResult.rowCount;
    const confirmedOrderIds = existingOrdersResult.rows
      .filter((row) => row.status === "confirmed")
      .map((row) => Number(row.id));

    if (confirmedOrderIds.length > 0) {
      const confirmedItemsResult = await client.query(
        `
          select
            product_id,
            sum(quantity)::int as quantity
          from order_items
          where order_id = any($1::bigint[])
          group by product_id
        `,
        [confirmedOrderIds],
      );

      for (const row of confirmedItemsResult.rows) {
        await client.query(
          `
            update products
            set stock_quantity = stock_quantity + $2,
                updated_at = now()
            where id = $1
          `,
          [Number(row.product_id), Number(row.quantity)],
        );
      }

      await insertInventoryLog(client, {
        action: "orders_restocked_before_clear",
        details: `Restored stock from ${confirmedOrderIds.length} confirmed order${confirmedOrderIds.length === 1 ? "" : "s"} before clearing order history.`,
      });
    }

    await client.query("delete from orders");

    await insertInventoryLog(client, {
      action: "orders_cleared",
      details: `Cleared ${deletedCount} order${deletedCount === 1 ? "" : "s"} from order history.`,
    });

    return { deletedCount };
  });
}

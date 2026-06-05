import { withClient } from "../db.js";
import {
  inventoryLogSupportsImportBatchId,
  inventoryLogSupportsPayload,
  normalizeInventoryLog,
} from "./shared.js";

export async function listInventoryLogs(limit = 40) {
  return withClient(async (client) => {
    const supportsImportBatchId = await inventoryLogSupportsImportBatchId();
    const supportsPayload = await inventoryLogSupportsPayload();
    const result = await client.query(
      `
        select
          id,
          action,
          ${supportsImportBatchId ? "import_batch_id," : "null as import_batch_id,"}
          product_id,
          product_code,
          product_name,
          category,
          ${supportsPayload ? "payload," : "null as payload,"}
          details,
          created_at
        from inventory_activity_logs
        order by created_at desc, id desc
        limit $1
      `,
      [limit],
    );

    return result.rows.map(normalizeInventoryLog);
  });
}

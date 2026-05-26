import { withClient } from "../db.js";
import { normalizeInventoryLog } from "./shared.js";

export async function listInventoryLogs(limit = 40) {
  return withClient(async (client) => {
    const result = await client.query(
      `
        select
          id,
          action,
          product_id,
          product_code,
          product_name,
          category,
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

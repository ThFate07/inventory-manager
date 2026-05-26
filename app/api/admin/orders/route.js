import {
  jsonError,
  jsonOk,
  requireAdmin,
} from "../../../../lib/api-response";
import { clearAllOrders, getAdminDashboardSnapshot } from "../../../../lib/inventory";

export async function DELETE() {
  return handleClearOrders();
}

async function handleClearOrders() {
  const unauthorizedResponse = await requireAdmin();
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const result = await clearAllOrders();
    const snapshot = await getAdminDashboardSnapshot();

    return jsonOk({
      ok: true,
      deletedCount: result.deletedCount,
      ...snapshot,
    });
  } catch (error) {
    return jsonError(error.message || "Unable to clear orders.", 400);
  }
}

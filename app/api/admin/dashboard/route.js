import { jsonError, jsonOk, requireAdmin } from "../../../../lib/api-response";
import { getAdminDashboardSnapshot } from "../../../../lib/inventory";

export async function GET() {
  return handleGetAdminDashboard();
}

async function handleGetAdminDashboard() {
  const unauthorizedResponse = await requireAdmin();
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const snapshot = await getAdminDashboardSnapshot();
    return jsonOk(snapshot);
  } catch {
    return jsonError("Unable to load admin dashboard.", 500);
  }
}

import {
  jsonError,
  jsonOk,
  readJson,
  requireAdmin,
} from "../../../../../../lib/api-response";
import { confirmOrder } from "../../../../../../lib/inventory";

export async function POST(request, { params }) {
  return handleConfirmOrder(request, params);
}

async function handleConfirmOrder(request, params) {
  const unauthorizedResponse = await requireAdmin();
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const body = await readJson(request, {});
    const orderId = await readOrderId(params);
    const order = await confirmOrder(orderId, body);
    return jsonOk({ order });
  } catch (error) {
    return jsonError(error.message || "Unable to confirm order.", 400);
  }
}

async function readOrderId(params) {
  const { orderId } = await params;
  return orderId;
}

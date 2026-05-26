import {
  jsonError,
  jsonOk,
  requireAdmin,
} from "../../../../../../lib/api-response";
import { reverseConfirmedOrder } from "../../../../../../lib/inventory";

export async function POST(_request, { params }) {
  return handleReverseOrder(params);
}

async function handleReverseOrder(params) {
  const unauthorizedResponse = await requireAdmin();
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const orderId = await readOrderId(params);
    const order = await reverseConfirmedOrder(orderId);
    return jsonOk({ order });
  } catch (error) {
    return jsonError(error.message || "Unable to reverse order.", 400);
  }
}

async function readOrderId(params) {
  const { orderId } = await params;
  return orderId;
}

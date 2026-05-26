import {
  jsonError,
  jsonOk,
  requireAdmin,
} from "../../../../../lib/api-response";
import { deleteOrder, getOrderByOrderId } from "../../../../../lib/inventory";

export async function GET(_request, { params }) {
  return handleGetOrder(params);
}

export async function DELETE(_request, { params }) {
  return handleDeleteOrder(params);
}

async function handleGetOrder(params) {
  const unauthorizedResponse = await requireAdmin();
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const orderId = await readOrderId(params);
    const order = await getOrderByOrderId(orderId);

    if (!order) {
      return jsonError("Order not found.", 404);
    }

    return jsonOk({ order });
  } catch (error) {
    return jsonError(error.message || "Unable to load order.", 400);
  }
}

async function handleDeleteOrder(params) {
  const unauthorizedResponse = await requireAdmin();
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const orderId = await readOrderId(params);
    const result = await deleteOrder(orderId);
    return jsonOk({ ok: true, ...result });
  } catch (error) {
    return jsonError(error.message || "Unable to delete order.", 400);
  }
}

async function readOrderId(params) {
  const { orderId } = await params;
  return orderId;
}

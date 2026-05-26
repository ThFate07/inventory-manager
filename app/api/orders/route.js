import { jsonError, jsonOk, readJson } from "../../../lib/api-response";
import { createPendingOrder } from "../../../lib/inventory";

export async function POST(request) {
  return handleCreateOrder(request);
}

async function handleCreateOrder(request) {
  try {
    const body = await readJson(request);
    const order = await createPendingOrder(body);
    return jsonOk({ order }, { status: 201 });
  } catch (error) {
    return jsonError(error.message || "Unable to place order.", 400);
  }
}

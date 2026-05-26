import {
  jsonError,
  jsonOk,
  readJson,
  requireAdmin,
} from "../../../../../lib/api-response";
import { deleteProduct, updateProduct } from "../../../../../lib/inventory";

export async function PATCH(request, { params }) {
  return handleUpdateProduct(request, params);
}

export async function DELETE(_request, { params }) {
  return handleDeleteProduct(params);
}

async function handleUpdateProduct(request, params) {
  const unauthorizedResponse = await requireAdmin();
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const body = await readJson(request);
    const productId = await readProductId(params);
    await updateProduct(productId, body);
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error.message || "Unable to update product.", 400);
  }
}

async function handleDeleteProduct(params) {
  const unauthorizedResponse = await requireAdmin();
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const productId = await readProductId(params);
    await deleteProduct(productId);
    return jsonOk({ ok: true });
  } catch (error) {
    if (error?.message === "Product not found.") {
      return jsonError("Product not found.", 404);
    }

    if (
      error?.code === "23503" ||
      /foreign key constraint|violates RESTRICT setting/i.test(error?.message || "")
    ) {
      return jsonError(
        "This product is used in existing order records and cannot be deleted.",
        409,
      );
    }

    return jsonError(error?.message || "Unable to delete product.", 400);
  }
}

async function readProductId(params) {
  const { id } = await params;
  return Number(id);
}

import {
  jsonError,
  jsonOk,
  readJson,
  requireAdmin,
} from "../../../../lib/api-response";
import {
  clearAllProducts,
  createProduct,
  listCategories,
  listProducts,
} from "../../../../lib/inventory";

export async function GET() {
  return handleGetAdminProducts();
}

export async function POST(request) {
  return handleCreateProduct(request);
}

export async function DELETE() {
  return handleDeleteAllProducts();
}

async function handleGetAdminProducts() {
  const unauthorizedResponse = await requireAdmin();
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const payload = await loadAdminInventory();
    return jsonOk(payload);
  } catch {
    return jsonError("Unable to load admin inventory.", 500);
  }
}

async function handleCreateProduct(request) {
  const unauthorizedResponse = await requireAdmin();
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const body = await readJson(request);
    await createProduct(body);
    const payload = await loadAdminInventory();
    return jsonOk({ ok: true, ...payload });
  } catch (error) {
    return jsonError(error.message || "Unable to create product.", 400);
  }
}

async function handleDeleteAllProducts() {
  const unauthorizedResponse = await requireAdmin();
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const result = await clearAllProducts();
    const payload = await loadAdminInventory();
    return jsonOk({
      ok: true,
      deletedCount: result.deletedCount,
      ...payload,
    });
  } catch (error) {
    return jsonError(error.message || "Unable to clear products.", 400);
  }
}

async function loadAdminInventory() {
  const [products, categories] = await Promise.all([
    listProducts({ admin: true }),
    listCategories(),
  ]);

  return { products, categories };
}

import { jsonError, jsonOk } from "../../../lib/api-response";
import { listCategories, listProducts } from "../../../lib/inventory";

export async function GET() {
  return handleGetProducts();
}

async function handleGetProducts() {
  try {
    const [products, categories] = await Promise.all([
      listProducts(),
      listCategories(),
    ]);

    return jsonOk({ products, categories });
  } catch {
    return jsonError("Unable to load products.", 500);
  }
}

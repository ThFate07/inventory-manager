import CrockeryInventoryManager from "../crockery_inventory_manager_website";
import { listCategories, listProducts } from "../lib/inventory";

export default async function Page() {
  const [products, categories] = await Promise.all([
    listProducts(),
    listCategories(),
  ]);

  return (
    <CrockeryInventoryManager
      initialProducts={products}
      initialCategories={categories}
    />
  );
}

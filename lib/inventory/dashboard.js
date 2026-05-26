import { listCategories } from "./categories.js";
import { listInventoryLogs } from "./logs.js";
import { listRecentOrders } from "./orders.js";
import { listProducts } from "./products.js";

export async function getAdminDashboardSnapshot() {
  const [products, categories, recentOrders, inventoryLogs] = await Promise.all([
    listProducts({ admin: true }),
    listCategories(),
    listRecentOrders(),
    listInventoryLogs(),
  ]);

  return {
    products,
    categories,
    recentOrders,
    inventoryLogs,
  };
}

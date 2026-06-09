import { listCategories } from "./categories.js";
import { listInventoryLogs } from "./logs.js";
import { listAllOrders, listRecentOrders } from "./orders.js";
import { listProducts } from "./products.js";

export async function getAdminDashboardSnapshot({ orderLimit = 12 } = {}) {
  const orderLoader = Number.isFinite(orderLimit)
    ? listRecentOrders(orderLimit)
    : listAllOrders();

  const [products, categories, recentOrders, inventoryLogs] = await Promise.all([
    listProducts({ admin: true }),
    listCategories(),
    orderLoader,
    listInventoryLogs(500),
  ]);

  return {
    products,
    categories,
    recentOrders,
    inventoryLogs,
  };
}

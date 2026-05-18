import { redirect } from "next/navigation";
import AdminInventoryManager from "../../../components/admin-inventory-manager";
import { getAuthenticatedAdmin } from "../../../lib/auth";
import { getAdminDashboardSnapshot } from "../../../lib/inventory";

export const metadata = {
  title: "Order History | Crockery Inventory Manager",
};

export default async function AdminHistoryPage() {
  const admin = await getAuthenticatedAdmin();

  if (!admin) {
    redirect("/admin/login");
  }

  const { products, categories, recentOrders, inventoryLogs } =
    await getAdminDashboardSnapshot();

  return (
    <AdminInventoryManager
      initialProducts={products}
      initialCategories={categories}
      initialRecentOrders={recentOrders}
      initialInventoryLogs={inventoryLogs}
      adminDisplayName={admin.display_name}
      initialSection="history"
    />
  );
}

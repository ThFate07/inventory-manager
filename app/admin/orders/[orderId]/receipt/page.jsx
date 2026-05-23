import { notFound, redirect } from "next/navigation";
import OrderReceiptPrint from "../../../../../components/order-receipt-print";
import { getAuthenticatedAdmin } from "../../../../../lib/auth";
import { getOrderByOrderId } from "../../../../../lib/inventory";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { orderId } = await params;

  return {
    title: `${orderId} Receipt | Crockery Inventory Manager`,
  };
}

export default async function OrderReceiptPage({ params, searchParams }) {
  const admin = await getAuthenticatedAdmin();

  if (!admin) {
    redirect("/admin/login");
  }

  const { orderId } = await params;
  const resolvedSearchParams = await searchParams;
  const order = await getOrderByOrderId(orderId);

  if (!order) {
    notFound();
  }

  return (
    <OrderReceiptPrint
      autoPrint={resolvedSearchParams?.autoprint === "1"}
      order={order}
    />
  );
}

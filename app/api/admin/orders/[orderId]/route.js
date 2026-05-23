import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "../../../../../lib/auth";
import { deleteOrder, getOrderByOrderId } from "../../../../../lib/inventory";

export async function GET(_request, { params }) {
  const admin = await getAuthenticatedAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { orderId } = await params;
    const order = await getOrderByOrderId(orderId);

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Unable to load order." },
      { status: 400 },
    );
  }
}

export async function DELETE(_request, { params }) {
  const admin = await getAuthenticatedAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { orderId } = await params;
    const result = await deleteOrder(orderId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Unable to delete order." },
      { status: 400 },
    );
  }
}

import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "../../../../../../lib/auth";
import { reverseConfirmedOrder } from "../../../../../../lib/inventory";

export async function POST(_request, { params }) {
  const admin = await getAuthenticatedAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { orderId } = await params;
    const order = await reverseConfirmedOrder(orderId);
    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Unable to reverse order." },
      { status: 400 },
    );
  }
}

import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "../../../../../../lib/auth";
import { confirmOrder } from "../../../../../../lib/inventory";

export async function POST(_request, { params }) {
  const admin = await getAuthenticatedAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const order = await confirmOrder(params.orderId);
    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Unable to confirm order." },
      { status: 400 },
    );
  }
}

import { NextResponse } from "next/server";
import { createPendingOrder } from "../../../lib/inventory";

export async function POST(request) {
  try {
    const body = await request.json();
    const order = await createPendingOrder(body);
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Unable to place order." },
      { status: 400 },
    );
  }
}

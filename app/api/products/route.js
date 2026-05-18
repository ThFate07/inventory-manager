import { NextResponse } from "next/server";
import { listCategories, listProducts } from "../../../lib/inventory";

export async function GET() {
  try {
    const [products, categories] = await Promise.all([
      listProducts(),
      listCategories(),
    ]);

    return NextResponse.json({ products, categories });
  } catch {
    return NextResponse.json(
      { error: "Unable to load products." },
      { status: 500 },
    );
  }
}

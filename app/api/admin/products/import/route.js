import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "../../../../../lib/auth";
import { importProducts, listCategories, listProducts } from "../../../../../lib/inventory";

export async function POST(request) {
  const admin = await getAuthenticatedAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const products = Array.isArray(body.products) ? body.products : [];
    const importMode = body.importMode === "images-only" ? "images-only" : "sheet";
    const importReport = {
      unmatchedProducts: Array.isArray(body.unmatchedProducts) ? body.unmatchedProducts : [],
      unmatchedImages: Array.isArray(body.unmatchedImages) ? body.unmatchedImages : [],
    };

    await importProducts(products, importReport, { importMode });

    const [updatedProducts, categories] = await Promise.all([
      listProducts({ admin: true }),
      listCategories(),
    ]);

    return NextResponse.json({ ok: true, products: updatedProducts, categories });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Unable to import products." },
      { status: 400 },
    );
  }
}

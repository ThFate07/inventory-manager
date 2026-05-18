import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "../../../../lib/auth";
import { createProduct, listCategories, listProducts } from "../../../../lib/inventory";

async function ensureAdmin() {
  const admin = await getAuthenticatedAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return null;
}

export async function GET() {
  const unauthorizedResponse = await ensureAdmin();
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const [products, categories] = await Promise.all([
      listProducts({ admin: true }),
      listCategories(),
    ]);

    return NextResponse.json({ products, categories });
  } catch {
    return NextResponse.json(
      { error: "Unable to load admin inventory." },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const unauthorizedResponse = await ensureAdmin();
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const body = await request.json();
    await createProduct(body);
    const [products, categories] = await Promise.all([
      listProducts({ admin: true }),
      listCategories(),
    ]);

    return NextResponse.json({ ok: true, products, categories });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Unable to create product." },
      { status: 400 },
    );
  }
}

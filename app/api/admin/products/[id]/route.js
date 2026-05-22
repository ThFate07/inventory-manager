import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "../../../../../lib/auth";
import { deleteProduct, updateProduct } from "../../../../../lib/inventory";

export async function PATCH(request, { params }) {
  const admin = await getAuthenticatedAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id } = await params;
    await updateProduct(Number(id), body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Unable to update product." },
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
    const { id } = await params;
    await deleteProduct(Number(id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error?.message === "Product not found.") {
      return NextResponse.json(
        { error: "Product not found." },
        { status: 404 },
      );
    }

    if (
      error?.code === "23503" ||
      /foreign key constraint|violates RESTRICT setting/i.test(error?.message || "")
    ) {
      return NextResponse.json(
        {
          error:
            "This product is used in existing order records and cannot be deleted.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: error?.message || "Unable to delete product." },
      { status: 400 },
    );
  }
}

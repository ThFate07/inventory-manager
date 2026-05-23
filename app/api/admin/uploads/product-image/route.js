import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "../../../../../lib/auth";
import { uploadProductImage } from "../../../../../lib/blob";

export async function POST(request) {
  const admin = await getAuthenticatedAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const productCode = String(formData.get("productCode") || "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Select an image file to upload." }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image uploads are supported." }, { status: 400 });
    }

    const uploaded = await uploadProductImage(file, {
      productCode,
      sourceFileName: file.name,
    });

    return NextResponse.json({
      ok: true,
      url: uploaded.url,
      pathname: uploaded.pathname,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Unable to upload image." },
      { status: 400 },
    );
  }
}

import { getProductImageAsset } from "../../../../../lib/inventory";

function decodeDataUrl(dataUrl) {
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/i.exec(dataUrl);

  if (!match) {
    throw new Error("Unsupported image data.");
  }

  const contentType = match[1] || "application/octet-stream";
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || "";
  const body = isBase64
    ? Buffer.from(payload, "base64")
    : Buffer.from(decodeURIComponent(payload), "utf8");

  return {
    body,
    contentType,
  };
}

export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    const asset = await getProductImageAsset(Number(id));

    if (!asset?.imageUrl) {
      return new Response("Not found.", { status: 404 });
    }

    if (!asset.imageUrl.startsWith("data:")) {
      return Response.redirect(asset.imageUrl, 307);
    }

    const { body, contentType } = decodeDataUrl(asset.imageUrl);

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new Response("Unable to load image.", { status: 400 });
  }
}

import { del, put } from "@vercel/blob";

const VERCEL_BLOB_HOST_PATTERN = /\.blob\.vercel-storage\.com$/i;

function sanitizeFileNameSegment(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "image";
}

export function hasBlobConfig() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function isManagedBlobUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  try {
    const url = new URL(value);
    return VERCEL_BLOB_HOST_PATTERN.test(url.hostname);
  } catch {
    return false;
  }
}

export async function uploadProductImage(file, { productCode = "", sourceFileName = "" } = {}) {
  if (!hasBlobConfig()) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured.");
  }

  if (!file) {
    throw new Error("Image file is required.");
  }

  const contentType = typeof file.type === "string" && file.type.startsWith("image/")
    ? file.type
    : "application/octet-stream";
  const extensionFromType = contentType.split("/")[1] || "bin";
  const providedName = sourceFileName || file.name || "";
  const hasExtension = /\.[a-z0-9]+$/i.test(providedName);
  const safeName = sanitizeFileNameSegment(
    hasExtension ? providedName : `${providedName || "upload"}.${extensionFromType}`,
  );
  const safeCode = sanitizeFileNameSegment(productCode);
  const key = `products/${safeCode}/${Date.now()}-${safeName}`;

  const blob = await put(key, file, {
    access: "public",
    addRandomSuffix: true,
    contentType,
  });

  return blob;
}

export async function deleteBlobUrl(url) {
  if (!hasBlobConfig() || !isManagedBlobUrl(url)) {
    return false;
  }

  await del(url);
  return true;
}

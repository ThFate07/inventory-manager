import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

let client;

function sanitizeFileNameSegment(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "image";
}

function trimSlashes(value) {
  return String(value || "").replace(/^\/+|\/+$/g, "");
}

function getPublicBaseUrl() {
  return String(process.env.R2_PUBLIC_BASE_URL || "").trim().replace(/\/+$/g, "");
}

function getBucketName() {
  return String(process.env.R2_BUCKET || "").trim();
}

function getUploadFolderPrefix() {
  return process.env.NODE_ENV === "production" ? "" : "dev";
}

function getAccountId() {
  return String(process.env.R2_ACCOUNT_ID || "").trim();
}

function getObjectUrl(key) {
  const publicBaseUrl = getPublicBaseUrl();

  if (!publicBaseUrl) {
    throw new Error("R2_PUBLIC_BASE_URL is not configured.");
  }

  const normalizedKey = trimSlashes(key);
  return `${publicBaseUrl}/${normalizedKey}`;
}

function getManagedObjectKey(value) {
  const publicBaseUrl = getPublicBaseUrl();

  if (!publicBaseUrl || typeof value !== "string" || !value.trim()) {
    return "";
  }

  try {
    const managedBaseUrl = new URL(publicBaseUrl);
    const candidateUrl = new URL(value);

    if (managedBaseUrl.origin !== candidateUrl.origin) {
      return "";
    }

    const basePath = trimSlashes(managedBaseUrl.pathname);
    const candidatePath = trimSlashes(candidateUrl.pathname);

    if (!basePath) {
      return candidatePath;
    }

    if (candidatePath === basePath) {
      return "";
    }

    if (!candidatePath.startsWith(`${basePath}/`)) {
      return "";
    }

    return candidatePath.slice(basePath.length + 1);
  } catch {
    return "";
  }
}

function getS3Client() {
  if (client) {
    return client;
  }

  const accountId = getAccountId();
  const accessKeyId = String(process.env.R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = String(process.env.R2_SECRET_ACCESS_KEY || "").trim();

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Cloudflare R2 credentials are not fully configured.");
  }

  client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return client;
}

export function hasBlobConfig() {
  return Boolean(
    getAccountId() &&
      String(process.env.R2_ACCESS_KEY_ID || "").trim() &&
      String(process.env.R2_SECRET_ACCESS_KEY || "").trim() &&
      getBucketName() &&
      getPublicBaseUrl(),
  );
}

export function isManagedBlobUrl(value) {
  return Boolean(getManagedObjectKey(value));
}

export async function uploadProductImage(file, { productCode = "", sourceFileName = "" } = {}) {
  return uploadImageToManagedStorage(file, {
    prefix: getManagedUploadPrefix("products"),
    productCode,
    sourceFileName,
  });
}

export async function uploadCatalogTempImage(
  file,
  { sessionId = "", productCode = "", sourceFileName = "" } = {},
) {
  const safeSessionId = sanitizeFileNameSegment(sessionId || "session");
  return uploadImageToManagedStorage(file, {
    prefix: getManagedUploadPrefix(`catalog-temp/${safeSessionId}`),
    productCode,
    sourceFileName,
  });
}

function getManagedUploadPrefix(pathname) {
  const uploadFolderPrefix = getUploadFolderPrefix();
  const normalizedPathname = trimSlashes(pathname);

  return uploadFolderPrefix ? `${uploadFolderPrefix}/${normalizedPathname}` : normalizedPathname;
}

async function uploadImageToManagedStorage(
  file,
  { prefix = "products", productCode = "", sourceFileName = "" } = {},
) {
  if (!hasBlobConfig()) {
    throw new Error("Cloudflare R2 image storage is not configured.");
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
  const normalizedPrefix = trimSlashes(prefix) || "products";
  const key = `${normalizedPrefix}/${safeCode}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeName}`;
  const clientInstance = getS3Client();
  const body = Buffer.from(await file.arrayBuffer());

  await clientInstance.send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );

  return {
    url: getObjectUrl(key),
    pathname: key,
  };
}

export async function deleteBlobUrl(url) {
  if (!hasBlobConfig() || !isManagedBlobUrl(url)) {
    return false;
  }

  const key = getManagedObjectKey(url);

  if (!key) {
    return false;
  }

  await getS3Client().send(
    new DeleteObjectCommand({
      Bucket: getBucketName(),
      Key: key,
    }),
  );

  return true;
}

import {
  jsonError,
  jsonOk,
  requireAdmin,
} from "../../../../../lib/api-response";
import { uploadCatalogTempImage } from "../../../../../lib/blob";

export async function POST(request) {
  return handleUploadCatalogTempImage(request);
}

async function handleUploadCatalogTempImage(request) {
  const unauthorizedResponse = await requireAdmin();
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const { file, productCode, sessionId } = await readUploadRequest(request);
    const validationError = validateImageUpload(file, sessionId);

    if (validationError) {
      return validationError;
    }

    const uploaded = await uploadCatalogTempImage(file, {
      sessionId,
      productCode,
      sourceFileName: file.name,
    });

    return jsonOk({
      ok: true,
      url: uploaded.url,
      pathname: uploaded.pathname,
      sessionId,
    });
  } catch (error) {
    return jsonError(error?.message || "Unable to upload catalog image.", 400);
  }
}

async function readUploadRequest(request) {
  const formData = await request.formData();

  return {
    file: formData.get("file"),
    productCode: String(formData.get("productCode") || "").trim(),
    sessionId: String(formData.get("sessionId") || "").trim(),
  };
}

function validateImageUpload(file, sessionId) {
  if (!(file instanceof File)) {
    return jsonError("Select an image file to upload.", 400);
  }

  if (!file.type.startsWith("image/")) {
    return jsonError("Only image uploads are supported.", 400);
  }

  if (!sessionId) {
    return jsonError("Catalog upload session is required.", 400);
  }

  return null;
}

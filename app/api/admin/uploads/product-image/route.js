import {
  jsonError,
  jsonOk,
  requireAdmin,
} from "../../../../../lib/api-response";
import { uploadProductImage } from "../../../../../lib/blob";

export async function POST(request) {
  return handleUploadProductImage(request);
}

async function handleUploadProductImage(request) {
  const unauthorizedResponse = await requireAdmin();
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const { file, productCode } = await readUploadRequest(request);
    const validationError = validateImageUpload(file);

    if (validationError) {
      return validationError;
    }

    const uploaded = await uploadProductImage(file, {
      productCode,
      sourceFileName: file.name,
    });

    return jsonOk({
      ok: true,
      url: uploaded.url,
      pathname: uploaded.pathname,
    });
  } catch (error) {
    return jsonError(error?.message || "Unable to upload image.", 400);
  }
}

async function readUploadRequest(request) {
  const formData = await request.formData();

  return {
    file: formData.get("file"),
    productCode: String(formData.get("productCode") || "").trim(),
  };
}

function validateImageUpload(file) {
  if (!(file instanceof File)) {
    return jsonError("Select an image file to upload.", 400);
  }

  if (!file.type.startsWith("image/")) {
    return jsonError("Only image uploads are supported.", 400);
  }

  return null;
}

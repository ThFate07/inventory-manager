import { NextResponse } from "next/server";
import {
  jsonError,
  jsonOk,
  readJson,
  requireAdmin,
} from "../../../../../lib/api-response";
import { importProducts, listCategories, listProducts } from "../../../../../lib/inventory";

export async function POST(request) {
  return handleImportProducts(request);
}

async function handleImportProducts(request) {
  const unauthorizedResponse = await requireAdmin();
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const body = await readJson(request);
    const payload = normalizeImportRequest(body);

    const report = await importProducts(payload.products, payload.importReport, payload.options);

    if (report.succeededCount === 0 && report.failedProducts.length > 0) {
      const failureDetails = report.failedProducts
        .map((item) => {
          return String(item.code || "").trim() || `Row ${item.index + 1}`;
        })
        .join("; ");

      return NextResponse.json(
        {
          error: failureDetails || "Unable to import products.",
          report,
        },
        { status: 400 },
      );
    }

    if (!payload.returnSnapshot) {
      return jsonOk({ ok: true, report });
    }

    const [updatedProducts, categories] = await Promise.all([
      listProducts({ admin: true }),
      listCategories(),
    ]);

    return jsonOk({ ok: true, products: updatedProducts, categories, report });
  } catch (error) {
    return jsonError(error.message || "Unable to import products.", 400);
  }
}

function normalizeImportRequest(body) {
  return {
    products: Array.isArray(body.products) ? body.products : [],
    returnSnapshot: body.returnSnapshot !== false,
    importReport: {
      unmatchedProducts: Array.isArray(body.unmatchedProducts)
        ? body.unmatchedProducts
        : [],
      unmatchedImages: Array.isArray(body.unmatchedImages)
        ? body.unmatchedImages
        : [],
    },
    options: {
      importMode: body.importMode === "images-only" ? "images-only" : "sheet",
      logUnmatched: body.logUnmatched !== false,
      logSummary: body.logSummary !== false,
      summaryProductCount: body.summaryProductCount,
      importBatchId: body.importBatchId,
    },
  };
}

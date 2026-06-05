import { NextResponse } from "next/server";
import { jsonError, jsonOk, requireAdmin } from "../../../../../../lib/api-response";
import { undoImportBatch } from "../../../../../../lib/inventory";

export async function POST(_request, context) {
  const unauthorizedResponse = await requireAdmin();
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const params = await context.params;
    const batchId = params?.batchId?.trim();

    if (!batchId) {
      return jsonError("Import batch ID is required.", 400);
    }

    const result = await undoImportBatch(batchId);
    return jsonOk({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        error: error.message || "Unable to undo import batch.",
      },
      { status: 400 },
    );
  }
}

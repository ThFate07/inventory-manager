import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "../../../../lib/auth";
import { clearAllOrders, getAdminDashboardSnapshot } from "../../../../lib/inventory";

export async function DELETE() {
  const admin = await getAuthenticatedAdmin();

  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await clearAllOrders();
    const snapshot = await getAdminDashboardSnapshot();

    return NextResponse.json({
      ok: true,
      deletedCount: result.deletedCount,
      ...snapshot,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Unable to clear orders." },
      { status: 400 },
    );
  }
}

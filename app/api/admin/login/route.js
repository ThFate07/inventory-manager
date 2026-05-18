import { NextResponse } from "next/server";
import { setAdminSession } from "../../../../lib/auth";
import { authenticateAdmin } from "../../../../lib/inventory";

export async function POST(request) {
  try {
    const body = await request.json();
    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required." },
        { status: 400 },
      );
    }

    const admin = await authenticateAdmin(username, password);

    if (!admin) {
      return NextResponse.json(
        { error: "Invalid admin credentials." },
        { status: 401 },
      );
    }

    const response = NextResponse.json({ ok: true });
    await setAdminSession(response, admin);
    return response;
  } catch {
    return NextResponse.json(
      { error: "Unable to complete login." },
      { status: 500 },
    );
  }
}

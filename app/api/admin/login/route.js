import { NextResponse } from "next/server";
import {
  checkAdminLoginLimit,
  clearAdminLoginFailures,
  getAdminLoginIdentifier,
  recordAdminLoginFailure,
} from "../../../../lib/admin-login-rate-limit";
import { setAdminSession } from "../../../../lib/auth";
import { authenticateAdmin } from "../../../../lib/inventory";

export async function POST(request) {
  try {
    const body = await request.json();
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    const ipAddress = getAdminLoginIdentifier(request);

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required." },
        { status: 400 },
      );
    }

    const limit = checkAdminLoginLimit({ ipAddress, username });

    if (!limit.allowed) {
      return NextResponse.json(
        { error: limit.error },
        {
          status: 429,
          headers: {
            "Retry-After": String(limit.retryAfterSeconds),
          },
        },
      );
    }

    const admin = await authenticateAdmin(username, password);

    if (!admin) {
      recordAdminLoginFailure({ ipAddress, username });
      return NextResponse.json(
        { error: "Invalid admin credentials." },
        { status: 401 },
      );
    }

    const response = NextResponse.json({ ok: true });
    clearAdminLoginFailures({ ipAddress, username });
    await setAdminSession(response, admin);
    return response;
  } catch {
    return NextResponse.json(
      { error: "Unable to complete login." },
      { status: 500 },
    );
  }
}

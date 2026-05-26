import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "./auth.js";

export function jsonError(message, status, init = {}) {
  return NextResponse.json({ error: message }, { status, ...init });
}

export function jsonOk(payload, init = {}) {
  return NextResponse.json(payload, init);
}

export async function requireAdmin() {
  const admin = await getAuthenticatedAdmin();

  if (!admin) {
    return jsonError("Unauthorized.", 401);
  }

  return null;
}

export async function readJson(request, fallback) {
  try {
    return await request.json();
  } catch {
    if (fallback !== undefined) {
      return fallback;
    }

    throw new Error("Invalid JSON body.");
  }
}

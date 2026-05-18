import crypto from "crypto";
import { cookies } from "next/headers";
import { hasDatabaseConfig, withClient } from "./db";

const SESSION_COOKIE_NAME = "crockery_admin_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 12;

function getSessionSecret() {
  return process.env.SESSION_SECRET || "change-me-in-env";
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, storedValue) {
  if (!storedValue?.includes(":")) {
    return false;
  }

  const [salt, expectedHash] = storedValue.split(":");
  const actualHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(expectedHash, "hex"), Buffer.from(actualHash, "hex"));
}

function signPayload(payload) {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
}

export function createSessionToken(session) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

export function parseSessionToken(token) {
  if (!token || !token.includes(".")) {
    return null;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature || signPayload(payload) !== signature) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));

    if (!session.expiresAt || Date.now() > session.expiresAt) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export async function setAdminSession(response, admin) {
  const token = createSessionToken({
    userId: admin.id,
    username: admin.username,
    displayName: admin.display_name,
    expiresAt: Date.now() + SESSION_DURATION_MS,
  });

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(Date.now() + SESSION_DURATION_MS),
  });

  return response;
}

export function clearAdminSession(response) {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });

  return response;
}

export async function getAuthenticatedAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionToken(token);

  if (!session) {
    return null;
  }

  if (!hasDatabaseConfig()) {
    return {
      id: session.userId,
      username: session.username,
      display_name: session.displayName,
    };
  }

  return withClient(async (client) => {
    const result = await client.query(
      "select id, username, display_name from admin_users where id = $1",
      [session.userId],
    );

    return result.rows[0] || null;
  }).catch(() => null);
}

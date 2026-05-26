import {
  checkAdminLoginLimit,
  clearAdminLoginFailures,
  getAdminLoginIdentifier,
  recordAdminLoginFailure,
} from "../../../../lib/admin-login-rate-limit";
import { jsonError, jsonOk, readJson } from "../../../../lib/api-response";
import { setAdminSession } from "../../../../lib/auth";
import { authenticateAdmin } from "../../../../lib/inventory";

export async function POST(request) {
  return handleAdminLogin(request);
}

async function handleAdminLogin(request) {
  try {
    const credentials = await readCredentials(request);
    const ipAddress = getAdminLoginIdentifier(request);
    const validationError = validateCredentials(credentials);

    if (validationError) {
      return jsonError(validationError, 400);
    }

    const rateLimitResponse = getRateLimitResponse(ipAddress, credentials.username);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    return createLoginResponse(credentials, ipAddress);
  } catch {
    return jsonError("Unable to complete login.", 500);
  }
}

async function readCredentials(request) {
  const body = await readJson(request);

  return {
    username: String(body.username || "").trim(),
    password: String(body.password || ""),
  };
}

function validateCredentials({ username, password }) {
  if (!username || !password) {
    return "Username and password are required.";
  }

  return null;
}

function getRateLimitResponse(ipAddress, username) {
  const limit = checkAdminLoginLimit({ ipAddress, username });

  if (!limit.allowed) {
    return jsonError(limit.error, 429, {
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
    });
  }

  return null;
}

async function createLoginResponse({ username, password }, ipAddress) {
  const admin = await authenticateAdmin(username, password);

  if (!admin) {
    recordAdminLoginFailure({ ipAddress, username });
    return jsonError("Invalid admin credentials.", 401);
  }

  clearAdminLoginFailures({ ipAddress, username });

  const response = jsonOk({ ok: true });
  await setAdminSession(response, admin);
  return response;
}

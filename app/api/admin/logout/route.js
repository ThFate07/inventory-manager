import { jsonOk } from "../../../../lib/api-response";
import { clearAdminSession } from "../../../../lib/auth";

export async function POST() {
  return handleAdminLogout();
}

async function handleAdminLogout() {
  const response = jsonOk({ ok: true });
  clearAdminSession(response);
  return response;
}

import { withClient } from "../db.js";
import { verifyPassword } from "../auth.js";

export async function authenticateAdmin(username, password) {
  return withClient(async (client) => {
    const result = await client.query(
      `
        select id, username, display_name, password_hash
        from admin_users
        where username = $1
      `,
      [username],
    );

    const admin = result.rows[0];
    if (!admin || !verifyPassword(password, admin.password_hash)) {
      return null;
    }

    return admin;
  });
}

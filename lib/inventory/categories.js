import { withClient } from "../db.js";
import { slugifyCategory } from "../category-utils.js";

export async function listCategories() {
  return withClient(async (client) => {
    const result = await client.query(`
      select id, name, slug
      from categories
      order by name asc
    `);

    return result.rows;
  });
}

export async function upsertCategory(client, categoryName) {
  const normalizedName = categoryName?.trim() || "General";
  const slug = slugifyCategory(normalizedName);
  const result = await client.query(
    `
      insert into categories (name, slug)
      values ($1, $2)
      on conflict (name)
      do update set slug = excluded.slug
      returning id, name, slug
    `,
    [normalizedName, slug],
  );

  return result.rows[0];
}

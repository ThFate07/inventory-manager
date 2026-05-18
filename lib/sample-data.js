export const sampleProducts = [
  {
    code: "CRK-101",
    name: "Classic Dinner Plate",
    category: "Plates",
    stockQuantity: 120,
    unitPriceInr: 249,
    imageUrl:
      "https://images.unsplash.com/photo-1603190287605-e6ade32fa852?q=80&w=1200&auto=format&fit=crop",
  },
  {
    code: "CRK-202",
    name: "Royal Tea Cup Set",
    category: "Cups",
    stockQuantity: 80,
    unitPriceInr: 499,
    imageUrl:
      "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?q=80&w=1200&auto=format&fit=crop",
  },
  {
    code: "CRK-303",
    name: "Premium Serving Bowl",
    category: "Bowls",
    stockQuantity: 45,
    unitPriceInr: 699,
    imageUrl:
      "https://images.unsplash.com/photo-1610701596061-2ecf227e85b2?q=80&w=1200&auto=format&fit=crop",
  },
  {
    code: "CRK-404",
    name: "Designer Glass Set",
    category: "Glasses",
    stockQuantity: 60,
    unitPriceInr: 899,
    imageUrl:
      "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?q=80&w=1200&auto=format&fit=crop",
  },
];

export function slugifyCategory(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "general";
}

export function deriveCategories(products = sampleProducts) {
  return [...new Set(products.map((product) => product.category))].map((name, index) => ({
    id: index + 1,
    name,
    slug: slugifyCategory(name),
  }));
}

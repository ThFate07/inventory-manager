export const sampleProducts = [
  {
    code: "CRK-101",
    name: "Classic Dinner Plate",
    category: "Plates",
    ctn: "",
    qtyPerCtn: "",
    catalogUnit: "1 pcs",
    stockQuantity: 120,
    unitPriceInr: 249,
    imageUrl: "",
  },
  {
    code: "CRK-202",
    name: "Royal Tea Cup Set",
    category: "Cups",
    ctn: "",
    qtyPerCtn: "",
    catalogUnit: "1 pcs",
    stockQuantity: 80,
    unitPriceInr: 499,
    imageUrl: "",
  },
  {
    code: "CRK-303",
    name: "Premium Serving Bowl",
    category: "Bowls",
    ctn: "",
    qtyPerCtn: "",
    catalogUnit: "1 pcs",
    stockQuantity: 45,
    unitPriceInr: 699,
    imageUrl: "",
  },
  {
    code: "CRK-404",
    name: "Designer Glass Set",
    category: "Glasses",
    ctn: "",
    qtyPerCtn: "",
    catalogUnit: "1 pcs",
    stockQuantity: 60,
    unitPriceInr: 899,
    imageUrl: "",
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

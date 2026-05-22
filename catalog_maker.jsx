"use client";

import { useEffect, useMemo, useState } from "react";

function buildCatalogProduct(product) {
  const packagingText =
    product.qtyPerCtn ? `${product.qtyPerCtn} IN CTN` : "";
  const baseDescription =
    product.description || product.name || "";

  return {
    id: product.id,
    image: product.imageUrl || null,
    price: String(Math.round(Number(product.unitPriceInr) || 0) || ""),
    qty: product.catalogUnit || "",
    inStock: Number(product.stockQuantity) > 0,
    description: baseDescription,
    details: packagingText,
    sku: product.code || "",
  };
}

function splitCatalogText(text, maxLineLength = 22) {
  const normalizedText = String(text || "").trim();
  if (!normalizedText) {
    return [];
  }

  const words = normalizedText.split(/\s+/);
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (currentLine && nextLine.length > maxLineLength) {
      lines.push(currentLine);
      currentLine = word;
      continue;
    }

    currentLine = nextLine;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function chunkCatalogProducts(products, pageSize = 9) {
  const pages = [];

  for (let index = 0; index < products.length; index += pageSize) {
    pages.push(products.slice(index, index + pageSize));
  }

  return pages;
}

function CatalogCard({ product, selected, onToggle }) {
  const descriptionText = [product.description, product.details].filter(Boolean).join(" ");
  const descriptionLines = splitCatalogText(descriptionText, 18).slice(0, 2);

  return (
    <div
      className="catalog-card"
      role="button"
      tabIndex={0}
      onClick={(event) => {
        if (event.target.closest("input, button, a, label")) {
          return;
        }

        onToggle(product.id);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle(product.id);
        }
      }}
      style={{
        border: "2px solid #000",
        backgroundColor: "#fff",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        fontFamily: "'Arial', sans-serif",
        fontSize: "12px",
        minHeight: "328px",
        cursor: "pointer",
        outline: "none",
        height: "100%",
      }}
    >
      <label
        className="no-print"
        style={{
          position: "absolute",
          top: "4px",
          right: "4px",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: "4px",
          background: "rgba(255,255,255,0.96)",
          borderRadius: "999px",
          padding: "3px 8px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
          fontSize: "10px",
          fontWeight: "700",
          color: "#444",
        }}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(product.id)}
          style={{ accentColor: "#f97316" }}
        />
        Include
      </label>

      <div
        style={{
          height: "254px",
          backgroundColor: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          padding: "10px 8px 6px",
          margin: "0 4px",
        }}
      >
        {product.image ? (
          <img
            src={product.image}
            alt={product.sku}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              objectPosition: "center",
              display: "block",
              background: "#fff",
            }}
          />
        ) : (
          <div style={{ color: "#b3b3b3", fontSize: "11px", textAlign: "center", padding: "8px" }}>
            <div style={{ fontSize: "22px", marginBottom: "4px" }}>🖼️</div>
            No Image
          </div>
        )}
      </div>

      <div
        style={{
          padding: "6px 8px 2px",
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          alignItems: "center",
          columnGap: "6px",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "3px" }}>
          <span style={{ color: "#cc0000", fontWeight: "bold", fontSize: "16px" }}>Rs</span>
          <span style={{ color: "#cc0000", fontWeight: "900", fontSize: "20px" }}>
            {product.price || "—"}
          </span>
        </div>
        <span style={{ color: "#000", fontWeight: "bold", fontSize: "14px", textAlign: "center" }}>
          {product.qty ? `for ${product.qty}` : ""}
        </span>
        <span
          style={{
            color: product.inStock ? "#15803d" : "#666",
            fontWeight: "900",
            fontSize: "13px",
            textAlign: "right",
            minWidth: "52px",
          }}
        >
          {product.inStock ? "IN STOCK" : ""}
        </span>
      </div>

      <div
        style={{
          padding: "4px 8px 6px",
          color: "#0000cc",
          fontWeight: "bold",
          fontSize: "14px",
          textAlign: "center",
          lineHeight: "1.25",
          minHeight: "44px",
          textTransform: "uppercase",
        }}
      >
        {descriptionLines.length > 0
          ? descriptionLines.map((line, index) => (
              <span key={`${product.id}-${index}`} style={{ display: "block" }}>
                {line}
              </span>
            ))
          : "Product description here"}
      </div>

      <div
        style={{
          padding: "0 8px 6px",
          fontWeight: "bold",
          fontSize: "14px",
          color: "#000",
          minHeight: "16px",
          textAlign: "left",
          lineHeight: "1.1",
        }}
      >
        {product.sku || "Item No."}
      </div>
    </div>
  );
}

export default function CatalogMaker({
  products = [],
  categories = [],
  initialTitle = "Product Catalog",
}) {
  const [catalogTitle, setCatalogTitle] = useState(initialTitle);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name-asc");
  const [selectedProductIds, setSelectedProductIds] = useState(() =>
    new Set(products.map((product) => product.id)),
  );

  useEffect(() => {
    setSelectedProductIds((current) => {
      const availableIds = new Set(products.map((product) => product.id));
      const next = new Set();

      for (const id of current) {
        if (availableIds.has(id)) {
          next.add(id);
        }
      }

      if (current.size === 0 && products.length > 0) {
        return new Set(products.map((product) => product.id));
      }

      return next;
    });
  }, [products]);

  const sortedProducts = useMemo(() => {
    const sorted = [...products];

    sorted.sort((left, right) => {
      switch (sortBy) {
        case "recent-desc": {
          const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
          const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
          if (leftTime !== rightTime) {
            return rightTime - leftTime;
          }
          return Number(right.id) - Number(left.id);
        }
        case "name-desc":
          return right.name.localeCompare(left.name);
        case "price-asc":
          return left.unitPriceInr - right.unitPriceInr;
        case "price-desc":
          return right.unitPriceInr - left.unitPriceInr;
        case "stock-desc":
          return right.stockQuantity - left.stockQuantity;
        case "stock-asc":
          return left.stockQuantity - right.stockQuantity;
        case "category-asc":
          return left.category.localeCompare(right.category) || left.name.localeCompare(right.name);
        default:
          return left.name.localeCompare(right.name);
      }
    });

    return sorted;
  }, [products, sortBy]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return sortedProducts.filter((product) => {
      const matchesCategory =
        categoryFilter === "all" || product.category === categoryFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        product.name.toLowerCase().includes(normalizedSearch) ||
        product.code.toLowerCase().includes(normalizedSearch) ||
        product.category.toLowerCase().includes(normalizedSearch);

      return matchesCategory && matchesSearch;
    });
  }, [categoryFilter, search, sortedProducts]);

  const selectedProducts = useMemo(
    () =>
      sortedProducts
        .filter((product) => selectedProductIds.has(product.id))
        .map(buildCatalogProduct),
    [selectedProductIds, sortedProducts],
  );

  const visibleSelectedProducts = useMemo(
    () =>
      filteredProducts
        .filter((product) => selectedProductIds.has(product.id))
        .map(buildCatalogProduct),
    [filteredProducts, selectedProductIds],
  );

  const selectedProductsInView = useMemo(
    () => filteredProducts.filter((product) => selectedProductIds.has(product.id)).length,
    [filteredProducts, selectedProductIds],
  );

  const visibleProductPages = useMemo(
    () => chunkCatalogProducts(visibleSelectedProducts, 9),
    [visibleSelectedProducts],
  );

  const totalSelected = useMemo(
    () => products.filter((product) => selectedProductIds.has(product.id)).length,
    [products, selectedProductIds],
  );

  function toggleSelection(productId) {
    setSelectedProductIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  }

  function selectAllFiltered() {
    setSelectedProductIds((current) => {
      const next = new Set(current);
      for (const product of filteredProducts) {
        next.add(product.id);
      }
      return next;
    });
  }

  function selectAllProducts() {
    setSelectedProductIds(new Set(products.map((product) => product.id)));
  }

  function clearSelection() {
    setSelectedProductIds(new Set());
  }

  function handlePrint() {
    window.print();
  }

  return (
    <>
      <style jsx global>{`
        @page {
          margin: 4mm;
          size: auto;
        }

        body {
          margin: 0;
        }

        * {
          box-sizing: border-box;
        }

        @media print {
          .no-print {
            display: none !important;
          }

          body {
            margin: 0;
          }

          .catalog-grid {
            grid-template-columns: repeat(3, 1fr) !important;
            grid-auto-rows: 1fr !important;
          }

          .catalog-card {
            min-height: 94mm !important;
            height: 94mm !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          .page-container {
            padding: 0 !important;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
          }

          .page-container,
          .page-container * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .catalog-print-page {
            break-after: page;
            page-break-after: always;
          }

          .catalog-print-page.catalog-print-page-last {
            break-after: auto;
            page-break-after: auto;
          }
        }
      `}</style>

      <section className="space-y-6">
        <div className="no-print rounded-[2rem] border border-white/10 bg-white p-6 text-gray-900 shadow-2xl">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-orange-500">
                  Catalog Builder
                </p>
                <h3 className="mt-2 text-3xl font-bold">Printable product catalog</h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
                  Pull products directly from the database, narrow the list, choose what belongs
                  in the catalog, then export a clean printable PDF.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[360px]">
                <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">
                    DB Products
                  </p>
                  <p className="mt-2 text-2xl font-bold text-stone-900">{products.length}</p>
                </div>
                <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">
                    Selected
                  </p>
                  <p className="mt-2 text-2xl font-bold text-stone-900">{totalSelected}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1.85fr)]">
              <section className="rounded-[1.75rem] border border-stone-200 bg-stone-50 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
                      Catalog Details
                    </p>
                    <p className="mt-2 text-sm leading-6 text-stone-500">
                      Set the title that will appear on the exported catalog page.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
                  >
                    Print / Save PDF
                  </button>
                </div>

                <label className="mt-5 block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                    Catalog Title
                  </span>
                  <input
                    value={catalogTitle}
                    onChange={(event) => setCatalogTitle(event.target.value)}
                    className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    placeholder="Catalog title"
                  />
                </label>
              </section>

              <section className="rounded-[1.75rem] border border-stone-200 bg-stone-50 p-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
                    Filter Products
                  </p>
                  <p className="mt-2 text-sm leading-6 text-stone-500">
                    Search the database, narrow to a category, then sort the current result set
                    before selecting products.
                  </p>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                      Search
                    </span>
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-400"
                      placeholder="Name, code, category"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                      Category
                    </span>
                    <select
                      value={categoryFilter}
                      onChange={(event) => setCategoryFilter(event.target.value)}
                      className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    >
                      <option value="all">All Categories</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.name}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block md:max-w-xs">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                      Sort
                    </span>
                    <select
                      value={sortBy}
                      onChange={(event) => setSortBy(event.target.value)}
                      className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    >
                      <option value="recent-desc">Recently Added</option>
                      <option value="name-asc">Name A-Z</option>
                      <option value="name-desc">Name Z-A</option>
                      <option value="price-asc">Price Low-High</option>
                      <option value="price-desc">Price High-Low</option>
                      <option value="stock-desc">Stock High-Low</option>
                      <option value="stock-asc">Stock Low-High</option>
                      <option value="category-asc">Category</option>
                    </select>
                  </label>
                </div>
              </section>
            </div>

            <section className="rounded-[1.75rem] border border-stone-200 bg-white p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
                    Selection Actions
                  </p>
                  <p className="mt-2 text-sm leading-6 text-stone-500">
                    {totalSelected} selected from {products.length} database products. Current
                    filter shows {filteredProducts.length} products, with {selectedProductsInView} already included.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[420px]">
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">
                      Filtered
                    </p>
                    <p className="mt-1 text-xl font-bold text-stone-900">{filteredProducts.length}</p>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">
                      In View
                    </p>
                    <p className="mt-1 text-xl font-bold text-stone-900">{selectedProductsInView}</p>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">
                      Ready to Print
                    </p>
                    <p className="mt-1 text-xl font-bold text-stone-900">{selectedProducts.length}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
                >
                  Get Filtered
                </button>
                <button
                  type="button"
                  onClick={selectAllProducts}
                  className="rounded-2xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="rounded-2xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                >
                  clear selection
                </button>
              </div>
            </section>
          </div>
        </div>

        <div className="page-container bg-white p-4 shadow-2xl">
          

          {selectedProducts.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "60px",
                color: "#888",
                background: "#fff",
                borderRadius: "10px",
                marginTop: "20px",
              }}
            >
              Select products from the catalog builder controls to generate a printable catalog.
            </div>
          ) : (
            visibleProductPages.map((pageProducts, pageIndex) => (
              <div
                key={`catalog-page-${pageIndex + 1}`}
                className={`catalog-print-page${
                  pageIndex === visibleProductPages.length - 1 ? " catalog-print-page-last" : ""
                }`}
                style={{
                  marginBottom: pageIndex === visibleProductPages.length - 1 ? "0" : "16px",
                }}
              >
                <div
                  className="catalog-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "0",
                    background: "#fff",
                    alignItems: "start",
                    gridAutoRows: "1fr",
                  }}
                >
                  {pageProducts.map((product) => (
                    <CatalogCard
                      key={product.id}
                      product={product}
                      selected={selectedProductIds.has(product.id)}
                      onToggle={toggleSelection}
                    />
                  ))}
                </div>
              </div>
            ))
          )}

          <div
            className="no-print"
            style={{ textAlign: "center", marginTop: "16px", color: "#777", fontSize: "12px" }}
          >
            Showing {visibleSelectedProducts.length} selected product{visibleSelectedProducts.length !== 1 ? "s" : ""}
            {" "}in the current filter, with {selectedProducts.length} included in the final output
          </div>
        </div>
      </section>
    </>
  );
}

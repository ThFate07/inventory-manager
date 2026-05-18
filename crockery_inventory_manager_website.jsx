"use client";

import { useEffect, useMemo, useState } from "react";

const CART_STORAGE_KEY = "crockery-cart";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function readCart() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(CART_STORAGE_KEY);
    return rawValue ? JSON.parse(rawValue) : [];
  } catch {
    return [];
  }
}

function writeCart(cart) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event("cart-updated"));
}

function CustomerProductCard({ product, cartQuantity, onAddToCart, onSetQuantity }) {
  return (
    <article className="overflow-hidden rounded-3xl bg-white shadow-xl transition duration-300 hover:-translate-y-1">
      <img
        src={product.imageUrl}
        alt={product.name}
        className="h-56 w-full object-cover"
      />

      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-700">
            {product.category}
          </span>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
            {product.code}
          </p>
        </div>

        <h3 className="mt-3 text-xl font-bold text-gray-900">{product.name}</h3>
        <p className="mt-4 text-lg font-bold text-green-600">
          {formatCurrency(product.unitPriceInr)}
        </p>

        <div className="mt-5 flex items-center gap-3">
          <input
            type="number"
            min="1"
            max={product.stockQuantity || 999}
            value={cartQuantity}
            onChange={(event) => onSetQuantity(product.id, event.target.value)}
            onBlur={(event) => {
              if (event.target.value.trim() === "") {
                onSetQuantity(product.id, "1");
              }
            }}
            className="w-24 rounded-xl border border-orange-200 px-3 py-2"
          />
          <button
            type="button"
            onClick={() => onAddToCart(product)}
            className="flex-1 rounded-xl bg-orange-500 px-4 py-2 font-semibold text-white transition hover:bg-orange-600"
          >
            Add to Cart
          </button>
        </div>
      </div>
    </article>
  );
}

export default function CrockeryInventoryManager({
  initialProducts = [],
  initialCategories = [],
}) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [quantityInputs, setQuantityInputs] = useState({});
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    function syncCartCount() {
      const cart = readCart();
      setCartCount(cart.reduce((sum, item) => sum + item.quantity, 0));
    }

    syncCartCount();
    window.addEventListener("storage", syncCartCount);
    window.addEventListener("cart-updated", syncCartCount);

    return () => {
      window.removeEventListener("storage", syncCartCount);
      window.removeEventListener("cart-updated", syncCartCount);
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return initialProducts.filter((product) => {
      const matchesCategory =
        selectedCategory === "All Categories" ||
        product.category === selectedCategory;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        product.name.toLowerCase().includes(normalizedSearch) ||
        product.code.toLowerCase().includes(normalizedSearch) ||
        product.category.toLowerCase().includes(normalizedSearch);

      return matchesCategory && matchesSearch;
    });
  }, [initialProducts, search, selectedCategory]);

  function getQuantityInput(productId) {
    return quantityInputs[productId] ?? "1";
  }

  function setQuantityInput(productId, value) {
    setQuantityInputs((current) => ({
      ...current,
      [productId]: value,
    }));
  }

  function addToCart(product) {
    const rawQuantity = Number(getQuantityInput(product.id));
    const quantity = Number.isFinite(rawQuantity) && rawQuantity > 0 ? Math.floor(rawQuantity) : 1;
    const cappedQuantity =
      product.stockQuantity > 0 ? Math.min(quantity, product.stockQuantity) : quantity;

    const currentCart = readCart();
    const existing = currentCart.find((item) => item.productId === product.id);
    let nextCart;

    if (existing) {
      nextCart = currentCart.map((item) =>
        item.productId === product.id
          ? {
              ...item,
              quantity:
                product.stockQuantity > 0
                  ? Math.min(item.quantity + cappedQuantity, product.stockQuantity)
                  : item.quantity + cappedQuantity,
            }
          : item,
      );
    } else {
      nextCart = [
        ...currentCart,
        {
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          unitPriceInr: product.unitPriceInr,
          quantity: cappedQuantity,
        },
      ];
    }

    writeCart(nextCart);
    setQuantityInputs((current) => ({
      ...current,
      [product.id]: "1",
    }));
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-100 text-gray-800">
      <header className="sticky top-0 z-10 border-b border-orange-100 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-orange-500">
              Customer Catalog
            </p>
            <h1 className="mt-1 text-4xl font-bold text-orange-600">
              Crockery Inventory Manager
            </h1>
            <p className="mt-2 max-w-2xl text-gray-500">
              Browse products and build a cart here, then place your pending order on the separate checkout page.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="rounded-xl border border-orange-200 bg-white px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option>All Categories</option>
              {initialCategories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
            <a
              href="/checkout"
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 px-5 py-3 text-center font-semibold text-white transition hover:-translate-y-0.5 hover:from-orange-600 hover:via-amber-500 hover:to-orange-700"
            >
              Checkout ({cartCount})
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <section className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-3xl bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-gray-500">Products Available</h2>
            <p className="mt-2 text-4xl font-bold">{initialProducts.length}</p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-gray-500">Collections</h2>
            <p className="mt-2 text-4xl font-bold">{initialCategories.length}</p>
          </div>
        </section>

        <section>
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-3xl font-bold">Inventory Products</h2>
              <p className="mt-1 text-gray-500">
                Showing {filteredProducts.length} items for customers.
              </p>
            </div>

            <div className="w-full lg:w-auto lg:min-w-[22rem]">
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search product code or item..."
                className="w-full rounded-2xl border border-orange-200 bg-white px-4 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => (
              <CustomerProductCard
                key={product.id ?? product.code}
                product={product}
                cartQuantity={getQuantityInput(product.id)}
                onAddToCart={addToCart}
                onSetQuantity={setQuantityInput}
              />
            ))}
          </div>

          {filteredProducts.length === 0 ? (
            <div className="mt-10 rounded-3xl border border-dashed border-orange-200 bg-white/70 p-10 text-center text-gray-500">
              No products matched your search.
            </div>
          ) : null}
        </section>
      </main>

      <footer className="py-8 text-center text-gray-500">
        Built for your crockery business with separated customer and admin access.
      </footer>
    </div>
  );
}

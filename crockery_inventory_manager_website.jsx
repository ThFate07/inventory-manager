"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getCartonPrice,
  getMaxCartonQuantity,
  getPiecesPerCartonValue,
  getPricingUnitLabel,
  getStoredCartonQuantity,
} from "./lib/cart-pricing";

const CART_STORAGE_KEY = "crockery-cart";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function Toast({ message, type = "success", onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === "success" ? "bg-green-500" : "bg-red-500";
  const icon = type === "success" ? "✓" : "✕";

  return (
    <div className={`${bgColor} fixed bottom-20 right-4 z-40 rounded-lg px-4 py-3 text-white shadow-lg flex items-center gap-3 sm:bottom-6 sm:right-6 animation-pulse`}>
      <span className="text-xl font-bold">{icon}</span>
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
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

function CustomerProductCard({
  product,
  cartQuantity,
  cartError,
  onAddToCart,
  onSetQuantity,
  onOpenImage,
}) {
  const [imageUnavailable, setImageUnavailable] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const showImage = Boolean(product.imageUrl) && !imageUnavailable;
  const priceUnitLabel = getPricingUnitLabel(product.name);
  const piecesPerCarton = getPiecesPerCartonValue(product.qtyPerCtn);
  const cartonPrice = getCartonPrice(product.unitPriceInr, product.qtyPerCtn);
  const hasTrackedStock = Number(product.stockQuantity) > 0;
  const maxCartons = getMaxCartonQuantity(product.stockQuantity, product.qtyPerCtn);
  const isOutOfStock = hasTrackedStock && maxCartons === 0;

  const handleAddToCart = async () => {
    setIsAdding(true);
    onAddToCart(product);
    // Simulate action completion for button feedback
    setTimeout(() => setIsAdding(false), 300);
  };

  return (
    <article className="overflow-hidden rounded-[1.6rem] bg-white shadow-xl transition duration-300 hover:-translate-y-1 sm:rounded-[2rem]">
      <div className="flex h-44 items-center justify-center bg-gradient-to-br from-white via-orange-50 to-amber-100 p-3 sm:h-64 sm:p-4">
        {showImage ? (
          <button
            type="button"
            onClick={() =>
              onOpenImage({
                src: product.imageUrl,
                alt: product.name,
                code: product.code,
              })
            }
            className="h-full w-full"
            aria-label={`Enlarge image for ${product.name}`}
          >
            <img
              src={product.imageUrl}
              alt={product.name}
              onError={() => setImageUnavailable(true)}
              className="h-full w-full object-contain"
            />
          </button>
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-2xl border border-dashed border-orange-200 bg-white/80 px-4 text-center text-sm font-medium text-orange-400">
            Image unavailable
          </div>
        )}
      </div>

      <div className="p-3 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-medium text-orange-700 sm:px-3 sm:text-sm">
            {product.category}
          </span>
          <p className="text-[10px] uppercase tracking-[0.14em] text-gray-400 sm:text-xs sm:tracking-[0.18em]">
            {product.code}
          </p>
        </div>

        <h3 className="mt-2 text-sm font-bold leading-snug text-gray-900 sm:mt-3 sm:text-xl">
          {product.name}
        </h3>
        {product.qtyPerCtn && product.ctn ? (
          <p className="mt-2 text-xs font-semibold text-gray-600 sm:text-sm">
            {product.qtyPerCtn} PIECES IN CTN
          </p>
        ) : null}
        <p className="mt-2 text-sm font-bold text-green-600 sm:mt-4 sm:text-lg">
          {formatCurrency(product.unitPriceInr)} / {priceUnitLabel}
        </p>
        {piecesPerCarton ? (
          <p className="mt-1 text-xs font-medium text-gray-500 sm:text-sm">
            {formatCurrency(cartonPrice)} / CTN
          </p>
        ) : null}

        <div className="mt-3 flex flex-col gap-2 sm:mt-5 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex w-full items-center rounded-xl border border-orange-200 bg-white sm:w-auto">
            <input
              type="number"
              min="1"
              value={cartQuantity}
              onChange={(event) => onSetQuantity(product.id, event.target.value)}
              onBlur={(event) => {
                if (event.target.value.trim() === "") {
                  onSetQuantity(product.id, "1");
                }
              }}
              disabled={isAdding}
              className="h-9 w-full min-w-0 rounded-l-xl px-3 py-2 text-sm outline-none disabled:opacity-50 sm:h-11 sm:w-24 sm:text-base"
            />
            <span className="flex h-9 shrink-0 items-center border-l border-orange-200 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500 sm:h-11 sm:text-sm">
              CTN
            </span>
          </div>
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={isOutOfStock || isAdding}
            className="h-9 w-full flex-1 rounded-xl bg-orange-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-gray-300 sm:h-11 sm:px-4 active:scale-95"
          >
            {isAdding ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                Adding...
              </span>
            ) : isOutOfStock ? (
              "Out of Stock"
            ) : (
              "Add to Cart"
            )}
          </button>
        </div>
        {cartError ? (
          <p className="mt-2 text-xs font-medium text-red-600">{cartError}</p>
        ) : null}
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
  const [quantityErrors, setQuantityErrors] = useState({});
  const [cartCount, setCartCount] = useState(0);
  const [enlargedImage, setEnlargedImage] = useState(null);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    function syncCartCount() {
      const cart = readCart();
      setCartCount(
        cart.reduce((sum, item) => sum + getStoredCartonQuantity(item), 0),
      );
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

  function setQuantityError(productId, message) {
    setQuantityErrors((current) => {
      if (!message) {
        const nextErrors = { ...current };
        delete nextErrors[productId];
        return nextErrors;
      }

      return {
        ...current,
        [productId]: message,
      };
    });
  }

  function showToast(message, type = "success") {
    const id = Date.now();
    setToasts((current) => [...current, { id, message, type }]);
  }

  function removeToast(id) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  function addToCart(product) {
    const rawCartonQuantity = Number(getQuantityInput(product.id));
    const cartonQuantity =
      Number.isFinite(rawCartonQuantity) && rawCartonQuantity > 0
        ? Math.floor(rawCartonQuantity)
        : 1;
    const piecesPerCarton = getPiecesPerCartonValue(product.qtyPerCtn) || 1;
    const maxCartons = getMaxCartonQuantity(product.stockQuantity, product.qtyPerCtn);

    const currentCart = readCart();
    const existing = currentCart.find((item) => item.productId === product.id);
    const existingCartons = existing ? getStoredCartonQuantity(existing) : 0;
    const requestedCartons = existingCartons + cartonQuantity;

    if (Number(product.stockQuantity) > 0 && maxCartons === 0) {
      setQuantityError(product.id, "This many cartons are not available in stock.");
      showToast("This product is out of stock", "error");
      return;
    }

    if (maxCartons > 0 && requestedCartons > maxCartons) {
      setQuantityError(
        product.id,
        `Only ${maxCartons} carton${maxCartons === 1 ? "" : "s"} are available in stock.`,
      );
      showToast(`Only ${maxCartons} carton${maxCartons === 1 ? "" : "s"} available`, "error");
      return;
    }

    let nextCart;

    if (existing) {
      nextCart = currentCart.map((item) =>
        item.productId === product.id
          ? {
              ...item,
              qtyPerCtn: product.qtyPerCtn,
              cartonQuantity: getStoredCartonQuantity(item) + cartonQuantity,
              quantity:
                (getStoredCartonQuantity(item) + cartonQuantity) * piecesPerCarton,
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
          qtyPerCtn: product.qtyPerCtn,
          unitPriceInr: product.unitPriceInr,
          cartonQuantity,
          quantity: cartonQuantity * piecesPerCarton,
        },
      ];
    }

    setQuantityError(product.id, "");
    writeCart(nextCart);
    setQuantityInputs((current) => ({
      ...current,
      [product.id]: "1",
    }));
    
    // Show success toast
    showToast(`${product.name} added to cart (${cartonQuantity} CTN)`, "success");
  }

  function closeEnlargedImage() {
    setEnlargedImage(null);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-100 text-gray-800">
      <header className="border-b border-orange-100 bg-white/95 shadow-sm sm:sticky sm:top-0 sm:z-10 sm:backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 sm:py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-orange-500 sm:text-sm">
              Customer Catalog
            </p>
            <h1 className="mt-1 text-2xl font-bold text-orange-600 sm:text-4xl">
              Deen Enterprise
            </h1>
            <p className="mt-1 max-w-2xl text-xs text-gray-500 sm:mt-2 sm:text-base">
              Browse products and build a cart here, then place your pending order on the separate checkout page.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="h-10 rounded-xl border border-orange-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 sm:h-11 sm:py-3"
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
              className="inline-flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 px-5 py-2 text-center text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:from-orange-600 hover:via-amber-500 hover:to-orange-700 sm:h-11 sm:py-3"
            >
              Checkout ({cartCount})
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-6 sm:py-8 sm:pb-8">
        <section className="mb-8 grid grid-cols-2 gap-4 md:mb-10 md:gap-6">
          <div className="rounded-3xl bg-white p-4 shadow-lg sm:p-6">
            <h2 className="text-sm font-semibold text-gray-500 sm:text-lg">Products Available</h2>
            <p className="mt-2 text-3xl font-bold sm:text-4xl">{initialProducts.length}</p>
          </div>

          <div className="rounded-3xl bg-white p-4 shadow-lg sm:p-6">
            <h2 className="text-sm font-semibold text-gray-500 sm:text-lg">Collections</h2>
            <p className="mt-2 text-3xl font-bold sm:text-4xl">{initialCategories.length}</p>
          </div>
        </section>

        <section>
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl">Inventory Products</h2>
              <p className="mt-1 text-sm text-gray-500 sm:text-base">
                Showing {filteredProducts.length} items for customers.
              </p>
            </div>

            <div className="w-full lg:w-auto lg:min-w-[22rem]">
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search product code or item..."
                className="h-12 w-full rounded-2xl border border-orange-200 bg-white px-4 py-3 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-8">
            {filteredProducts.map((product) => (
              <CustomerProductCard
                key={product.id ?? product.code}
                product={product}
                cartQuantity={getQuantityInput(product.id)}
                cartError={quantityErrors[product.id]}
                onAddToCart={addToCart}
                onSetQuantity={setQuantityInput}
                onOpenImage={setEnlargedImage}
              />
            ))}
          </div>

          {filteredProducts.length === 0 ? (
            <div className="mt-10 rounded-3xl border border-dashed border-orange-200 bg-white/70 p-8 text-center text-sm text-gray-500 sm:p-10 sm:text-base">
              No products matched your search.
            </div>
          ) : null}
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-orange-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-500">Cart</p>
            <p className="truncate text-sm font-semibold text-gray-800">
              {cartCount} item{cartCount === 1 ? "" : "s"} selected
            </p>
          </div>
          <a
            href="/checkout"
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 px-5 text-sm font-semibold text-white"
          >
            Checkout
          </a>
        </div>
      </div>

      <footer className="py-8 text-center text-sm text-gray-500">
        Built for your crockery business with separated customer and admin access.
      </footer>

      {enlargedImage ? (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={closeEnlargedImage}
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged product image"
        >
          <div
            className="relative w-full max-w-4xl rounded-[2rem] bg-white p-3 shadow-2xl sm:p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeEnlargedImage}
              className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/75 text-xl font-semibold text-white"
              aria-label="Close enlarged image"
            >
              ×
            </button>
            <div className="flex max-h-[85vh] min-h-[16rem] items-center justify-center overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-white via-orange-50 to-amber-100 p-4">
              <img
                src={enlargedImage.src}
                alt={enlargedImage.alt}
                className="max-h-[75vh] w-full object-contain"
              />
            </div>
            <div className="px-2 pb-1 pt-4">
              <p className="text-lg font-semibold text-gray-900">{enlargedImage.alt}</p>
              {enlargedImage.code ? (
                <p className="mt-1 text-sm uppercase tracking-[0.16em] text-gray-500">
                  {enlargedImage.code}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}

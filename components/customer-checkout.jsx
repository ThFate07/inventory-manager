"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getCartonPrice,
  getMaxCartonQuantity,
  getPiecesPerCartonValue,
  getPricingUnitLabel,
  getStoredCartonQuantity,
} from "../lib/cart-pricing";

const CART_STORAGE_KEY = "crockery-cart";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function emptyCheckoutForm() {
  return {
    customerName: "",
    customerPhone: "",
    notes: "",
  };
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

export default function CustomerCheckout({ initialProducts = [] }) {
  const [cart, setCart] = useState([]);
  const [checkoutForm, setCheckoutForm] = useState(emptyCheckoutForm());
  const [checkoutError, setCheckoutError] = useState("");
  const [cartErrors, setCartErrors] = useState({});
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);

  useEffect(() => {
    function syncCart() {
      setCart(readCart());
    }

    syncCart();
    window.addEventListener("storage", syncCart);
    window.addEventListener("cart-updated", syncCart);

    return () => {
      window.removeEventListener("storage", syncCart);
      window.removeEventListener("cart-updated", syncCart);
    };
  }, []);

  const productsById = useMemo(
    () => new Map(initialProducts.map((product) => [product.id, product])),
    [initialProducts],
  );

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity * item.unitPriceInr, 0),
    [cart],
  );

  function updateCartQuantity(productId, value) {
    const product = productsById.get(productId);
    const existingItem = cart.find((item) => item.productId === productId);
    const qtyPerCtn = product?.qtyPerCtn || existingItem?.qtyPerCtn;
    const piecesPerCarton = getPiecesPerCartonValue(qtyPerCtn) || 1;
    const cartonQuantity = Math.max(1, Math.floor(Number(value) || 1));
    const maxCartons = getMaxCartonQuantity(product?.stockQuantity, qtyPerCtn);
    const hasTrackedStock = Number(product?.stockQuantity) > 0;

    if (hasTrackedStock && maxCartons === 0) {
      setCartErrors((current) => ({
        ...current,
        [productId]: "This many cartons are not available in stock.",
      }));
      return;
    }

    if (hasTrackedStock && cartonQuantity > maxCartons) {
      setCartErrors((current) => ({
        ...current,
        [productId]: `Only ${maxCartons} carton${maxCartons === 1 ? "" : "s"} are available in stock.`,
      }));
      return;
    }

    const nextCart = cart.map((item) =>
      item.productId === productId
        ? {
            ...item,
            qtyPerCtn,
            cartonQuantity,
            quantity: cartonQuantity * piecesPerCarton,
          }
        : item,
    );
    setCartErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[productId];
      return nextErrors;
    });
    setCart(nextCart);
    writeCart(nextCart);
  }

  function removeFromCart(productId) {
    const nextCart = cart.filter((item) => item.productId !== productId);
    setCartErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[productId];
      return nextErrors;
    });
    setCart(nextCart);
    writeCart(nextCart);
  }

  function updateCheckoutField(field, value) {
    setCheckoutForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleCheckout(event) {
    event.preventDefault();
    setCheckoutError("");
    setPlacedOrder(null);

    if (cart.length === 0) {
      setCheckoutError("Add at least one item to the cart before checkout.");
      return;
    }

    setIsPlacingOrder(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerName: checkoutForm.customerName,
          customerPhone: checkoutForm.customerPhone,
          notes: checkoutForm.notes,
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setCheckoutError(payload.error || "Unable to place order.");
        return;
      }

      setPlacedOrder(payload.order);
      setCart([]);
      writeCart([]);
      setCheckoutForm(emptyCheckoutForm());
    } catch {
      setCheckoutError("Unable to place order.");
    } finally {
      setIsPlacingOrder(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-100 px-4 py-6 pb-28 text-gray-800 sm:px-6 sm:py-12 sm:pb-12">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
        <section className="rounded-[2rem] bg-black p-6 text-white shadow-2xl sm:p-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-orange-300 sm:text-sm">
            Pending Checkout
          </p>
          <h1 className="mt-3 text-3xl font-bold leading-tight sm:mt-4 sm:text-5xl">
            Review the cart here and submit the order separately.
          </h1>
          <p className="mt-4 max-w-xl text-sm text-white/70 sm:mt-5 sm:text-lg">
            Customers can place orders without payment. The order stays pending until the admin confirms the order ID and payment.
          </p>
          <a
            href="/"
            className="mt-6 inline-flex h-11 items-center rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 sm:mt-8"
          >
            Back to Catalog
          </a>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-2xl sm:p-8">
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">Checkout</h2>
          <p className="mt-2 text-sm text-gray-500 sm:text-base">
            Orders are submitted without payment and stay pending until the admin confirms them.
          </p>

          <div className="mt-6 space-y-4">
            {cart.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-orange-200 bg-orange-50 p-5 text-sm text-gray-500 sm:text-base">
                Your cart is empty.
              </div>
            ) : (
              cart.map((item) => (
                (() => {
                  const product = productsById.get(item.productId);
                  const qtyPerCtn = product?.qtyPerCtn || item.qtyPerCtn;
                  const priceUnitLabel = getPricingUnitLabel(item.productName);
                  const cartonQuantity = getStoredCartonQuantity(item);
                  const cartonPrice = getCartonPrice(item.unitPriceInr, qtyPerCtn);
                  const maxCartons = getMaxCartonQuantity(product?.stockQuantity, qtyPerCtn);

                  return (
                    <div
                      key={item.productId}
                      className="rounded-2xl border border-orange-100 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">{item.productName}</p>
                          <p className="text-sm text-gray-500">{item.productCode}</p>
                          <p className="mt-1 text-sm font-medium text-gray-500">
                            {formatCurrency(item.unitPriceInr)} / {priceUnitLabel}
                          </p>
                          <p className="text-sm font-medium text-gray-500">
                            {formatCurrency(cartonPrice)} / CTN
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.productId)}
                          className="self-start text-sm font-semibold text-red-500"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="w-full sm:w-auto">
                          <div className="flex w-full items-center rounded-xl border border-orange-200 bg-white sm:w-auto">
                            <input
                              type="number"
                              min="1"
                              value={cartonQuantity}
                              onChange={(event) =>
                                updateCartQuantity(item.productId, event.target.value)
                              }
                              className="h-11 w-full min-w-0 rounded-l-xl px-3 py-2 text-base outline-none sm:w-24"
                            />
                            <span className="flex h-11 shrink-0 items-center border-l border-orange-200 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500 sm:text-sm">
                              CTN
                            </span>
                          </div>
                          {cartErrors[item.productId] ? (
                            <p className="mt-2 text-xs font-medium text-red-600">
                              {cartErrors[item.productId]}
                            </p>
                          ) : null}
                        </div>
                        <p className="text-base font-semibold text-green-600 sm:text-right">
                          {formatCurrency(item.unitPriceInr * item.quantity)}
                        </p>
                      </div>
                    </div>
                  );
                })()
              ))
            )}
          </div>

          <div className="mt-6 rounded-2xl bg-stone-900 p-5 text-white">
            <p className="text-[11px] uppercase tracking-[0.2em] text-orange-300 sm:text-sm">Pending Total</p>
            <p className="mt-2 text-2xl font-bold sm:text-3xl">{formatCurrency(cartTotal)}</p>
          </div>

          <form id="customer-checkout-form" onSubmit={handleCheckout} className="mt-6 space-y-4">
            <input
              value={checkoutForm.customerName}
              onChange={(event) => updateCheckoutField("customerName", event.target.value)}
              className="h-12 w-full rounded-2xl border border-orange-200 px-4 py-3 text-base"
              placeholder="Customer Name"
              required
            />
            <input
              value={checkoutForm.customerPhone}
              onChange={(event) => updateCheckoutField("customerPhone", event.target.value)}
              className="h-12 w-full rounded-2xl border border-orange-200 px-4 py-3 text-base"
              placeholder="Phone Number"
            />
            <textarea
              value={checkoutForm.notes}
              onChange={(event) => updateCheckoutField("notes", event.target.value)}
              className="w-full rounded-2xl border border-orange-200 px-4 py-3 text-base"
              placeholder="Order notes"
              rows="3"
            />

            {checkoutError ? (
              <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {checkoutError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isPlacingOrder}
              className="hidden h-12 w-full rounded-2xl bg-black px-5 py-3 font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400 sm:block"
            >
              {isPlacingOrder ? "Placing Order..." : "Checkout Without Payment"}
            </button>
          </form>

          {placedOrder ? (
            <div className="mt-6 rounded-2xl bg-green-50 p-5 text-green-900">
              <p className="text-sm font-semibold uppercase tracking-[0.2em]">
                Order Submitted
              </p>
              <p className="mt-2 text-2xl font-bold">{placedOrder.orderId}</p>
              <p className="mt-2 text-sm">
                Share this order ID with the admin. Stock will be deducted only after confirmation and payment approval.
              </p>
            </div>
          ) : null}
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-orange-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-500">Pending Total</p>
            <p className="truncate text-sm font-semibold text-gray-900">{formatCurrency(cartTotal)}</p>
          </div>
          <button
            type="submit"
            form="customer-checkout-form"
            disabled={isPlacingOrder || cart.length === 0}
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isPlacingOrder ? "Placing..." : "Place Order"}
          </button>
        </div>
      </div>
    </main>
  );
}

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
    const quantity = Math.max(1, Number(value) || 1);
    const cappedQuantity =
      product?.stockQuantity > 0 ? Math.min(quantity, product.stockQuantity) : quantity;
    const nextCart = cart.map((item) =>
      item.productId === productId ? { ...item, quantity: cappedQuantity } : item,
    );
    setCart(nextCart);
    writeCart(nextCart);
  }

  function removeFromCart(productId) {
    const nextCart = cart.filter((item) => item.productId !== productId);
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
    <main className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-100 px-6 py-12 text-gray-800">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[2rem] bg-black p-10 text-white shadow-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-orange-300">
            Pending Checkout
          </p>
          <h1 className="mt-4 text-5xl font-bold leading-tight">
            Review the cart here and submit the order separately.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-white/70">
            Customers can place orders without payment. The order stays pending until the admin confirms the order ID and payment.
          </p>
          <a
            href="/"
            className="mt-8 inline-block rounded-2xl border border-white/15 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
          >
            Back to Catalog
          </a>
        </section>

        <section className="rounded-3xl bg-white p-8 shadow-2xl">
          <h2 className="text-3xl font-bold text-gray-900">Checkout</h2>
          <p className="mt-2 text-gray-500">
            Orders are submitted without payment and stay pending until the admin confirms them.
          </p>

          <div className="mt-6 space-y-4">
            {cart.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-orange-200 bg-orange-50 p-5 text-gray-500">
                Your cart is empty.
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.productId}
                  className="rounded-2xl border border-orange-100 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{item.productName}</p>
                      <p className="text-sm text-gray-500">{item.productCode}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.productId)}
                      className="text-sm font-semibold text-red-500"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(event) =>
                        updateCartQuantity(item.productId, event.target.value)
                      }
                      className="w-24 rounded-xl border border-orange-200 px-3 py-2"
                    />
                    <p className="font-semibold text-green-600">
                      {formatCurrency(item.unitPriceInr * item.quantity)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-6 rounded-2xl bg-stone-900 p-5 text-white">
            <p className="text-sm uppercase tracking-[0.2em] text-orange-300">Pending Total</p>
            <p className="mt-2 text-3xl font-bold">{formatCurrency(cartTotal)}</p>
          </div>

          <form onSubmit={handleCheckout} className="mt-6 space-y-4">
            <input
              value={checkoutForm.customerName}
              onChange={(event) => updateCheckoutField("customerName", event.target.value)}
              className="w-full rounded-2xl border px-4 py-3"
              placeholder="Customer Name"
              required
            />
            <input
              value={checkoutForm.customerPhone}
              onChange={(event) => updateCheckoutField("customerPhone", event.target.value)}
              className="w-full rounded-2xl border px-4 py-3"
              placeholder="Phone Number"
            />
            <textarea
              value={checkoutForm.notes}
              onChange={(event) => updateCheckoutField("notes", event.target.value)}
              className="w-full rounded-2xl border px-4 py-3"
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
              className="w-full rounded-2xl bg-black px-5 py-3 font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
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
    </main>
  );
}

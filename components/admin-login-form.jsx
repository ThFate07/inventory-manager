"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginForm() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error || "Login failed.");
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setError("Unable to reach the login service.");
    } finally {
      setSubmitting(false);
    }
  }

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl bg-white p-8 shadow-2xl"
    >
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-orange-500">
          Protected Access
        </p>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">Admin Login</h1>
        <p className="mt-2 text-gray-500">
          Sign in to manage stock, pricing, Excel imports, and product edits.
        </p>
      </div>

      <div className="space-y-4">
        <input
          type="text"
          value={form.username}
          onChange={(event) => updateField("username", event.target.value)}
          placeholder="Username"
          className="w-full rounded-2xl border border-orange-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-400"
          autoComplete="username"
          required
        />
        <input
          type="password"
          value={form.password}
          onChange={(event) => updateField("password", event.target.value)}
          placeholder="Password"
          className="w-full rounded-2xl border border-orange-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-400"
          autoComplete="current-password"
          required
        />
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 w-full rounded-2xl bg-black px-5 py-3 font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        {submitting ? "Signing in..." : "Sign In"}
      </button>

      <p className="mt-5 text-sm text-gray-500">
        Customer catalog remains available at the home page.
      </p>
    </form>
  );
}

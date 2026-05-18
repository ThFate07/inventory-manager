import AdminLoginForm from "../../../components/admin-login-form";

export const metadata = {
  title: "Admin Login | Crockery Inventory Manager",
};

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-100 px-6 py-12">
      <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2rem] bg-black p-10 text-white shadow-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-orange-300">
            Secure Route
          </p>
          <h2 className="mt-4 text-5xl font-bold leading-tight">
            Admin controls now live on their own route.
          </h2>
          <p className="mt-5 max-w-xl text-lg text-white/70">
            Customers stay on the public catalog, while authenticated admins can manage stock,
            imports, pricing, and visibility from the dashboard.
          </p>
          <a
            href="/"
            className="mt-8 inline-block rounded-2xl border border-white/15 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
          >
            Back to Customer View
          </a>
        </section>

        <AdminLoginForm />
      </div>
    </main>
  );
}

import ProductAuditForm from "./components/ProductAuditForm";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-16">
      <header className="mb-16">
        <span className="text-sm font-semibold uppercase tracking-widest text-gray-500">
          ValueGuard
        </span>

        <h1 className="mt-6 max-w-2xl text-4xl font-bold tracking-tight text-gray-950 sm:text-6xl">
          Make smarter shopping decisions.
        </h1>

        <p className="mt-5 max-w-xl text-lg leading-8 text-gray-600">
          Evaluate product claims against evidence before you buy.
          Understand what is verified, what is uncertain, and why.
        </p>
      </header>

      <section className="w-full max-w-2xl">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">
          Audit a product
        </h2>

        <ProductAuditForm />

        <p className="mt-3 text-sm text-gray-500">
          Enter a product listing URL to begin. No claims are verified yet.
        </p>
      </section>

      <footer className="mt-auto pt-24 text-sm text-gray-500">
        Evidence first. Transparent decisions.
      </footer>
    </main>
  );
}
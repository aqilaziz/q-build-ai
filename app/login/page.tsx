import Link from "next/link";
import { ArrowLeft, LogIn } from "lucide-react";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#f5f6f1] px-4 py-4 text-[#171b17]">
      <div className="mx-auto w-full max-w-md">
        <Link
          href="/"
          className="inline-flex size-10 items-center justify-center rounded-md border border-[#cbd3c4] bg-white"
          aria-label="Kembali"
        >
          <ArrowLeft size={18} />
        </Link>

        <section className="mt-6 rounded-lg border border-[#d9ded2] bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-md bg-[#174832] text-white">
              <LogIn size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-[#52645c]">
                Demo auth
              </p>
              <h1 className="text-xl font-bold">Masuk Q-Build AI</h1>
            </div>
          </div>

          <form className="mt-5 space-y-3">
            <label className="block text-sm font-semibold">
              Email
              <input
                defaultValue="demo@qhomemart.local"
                type="email"
                className="mt-1 w-full rounded-md border border-[#cbd3c4] px-3 py-3 text-sm outline-none focus:border-[#174832]"
              />
            </label>
            <label className="block text-sm font-semibold">
              Password
              <input
                defaultValue="password-demo"
                type="password"
                className="mt-1 w-full rounded-md border border-[#cbd3c4] px-3 py-3 text-sm outline-none focus:border-[#174832]"
              />
            </label>
            <Link
              href="/"
              className="inline-flex w-full items-center justify-center rounded-md bg-[#174832] px-4 py-3 text-sm font-bold text-white"
            >
              Lanjut mode demo
            </Link>
          </form>

          <p className="mt-4 text-sm leading-6 text-[#52645c]">
            Untuk demo kompetisi, quotation tetap bisa disimpan lewat fallback
            browser bila API auth belum aktif.
          </p>
        </section>
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Clipboard,
  Copy,
  Loader2,
  PackageCheck,
  ShoppingCart,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatCurrency, loadQuote, SavedQuote } from "@/components/quote-data";

export function QuoteDetail() {
  const params = useParams<{ id: string }>();
  const [quote, setQuote] = useState<SavedQuote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    loadQuote(params.id).then((item) => {
      if (!isMounted) return;
      setQuote(item);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [params.id]);

  const summary = useMemo(() => {
    if (!quote) return "";
    const items = quote.items
      .map(
        (item) =>
          `- ${item.name}: ${item.quantity} ${item.unit} (${formatCurrency(item.lineTotal)})`,
      )
      .join("\n");
    return `${quote.title}\n${quote.problemSummary}\n\n${quote.diagnosis}\n\n${items}\n\nSubtotal: ${formatCurrency(quote.subtotal)}`;
  }, [quote]);

  async function handleCopy() {
    if (!summary) return;
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="min-h-screen bg-[#f5f6f1] text-[#171b17]">
      <div className="mx-auto w-full max-w-4xl px-4 py-4">
        <header className="flex items-center justify-between gap-3 border-b border-[#d9ded2] pb-4">
          <Link
            href="/quotes"
            className="inline-flex size-10 items-center justify-center rounded-md border border-[#cbd3c4] bg-white"
            aria-label="Kembali"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase text-[#52645c]">
              Detail quotation
            </p>
            <h1 className="truncate text-xl font-bold">
              {quote?.title ?? "Memuat..."}
            </h1>
          </div>
          <Clipboard className="text-[#174832]" size={22} />
        </header>

        {isLoading ? (
          <div className="mt-8 flex items-center gap-2 text-sm text-[#52645c]">
            <Loader2 className="animate-spin" size={17} />
            Memuat detail...
          </div>
        ) : quote ? (
          <section className="mt-4 space-y-4">
            <div className="rounded-lg border border-[#d9ded2] bg-white p-4">
              <p className="text-sm font-bold">Ringkasan masalah</p>
              <p className="mt-2 text-sm leading-6 text-[#52645c]">
                {quote.problemSummary}
              </p>
              <p className="mt-4 text-sm font-bold">Diagnosis</p>
              <p className="mt-2 text-sm leading-6">{quote.diagnosis}</p>
            </div>

            <div className="rounded-lg border border-[#d9ded2] bg-white p-4">
              <div className="flex items-center gap-2">
                <ShoppingCart className="text-[#174832]" size={18} />
                <h2 className="font-bold">Produk dan quantity</h2>
              </div>
              <div className="mt-3 space-y-3">
                {quote.items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-md border border-[#e1e5dc] p-3"
                  >
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="font-semibold">{item.name}</p>
                        <p className="mt-1 text-xs text-[#52645c]">
                          {item.quantity} {item.unit} x{" "}
                          {formatCurrency(item.unitPrice)}
                        </p>
                      </div>
                      <p className="text-sm font-bold">
                        {formatCurrency(item.lineTotal)}
                      </p>
                    </div>
                    <p className="mt-2 text-sm leading-5 text-[#52645c]">
                      {item.reason}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-[#d9ded2] bg-white p-4">
              <div className="flex items-center gap-2">
                <PackageCheck className="text-[#174832]" size={18} />
                <h2 className="font-bold">Breakdown kalkulasi</h2>
              </div>
              <dl className="mt-3 space-y-2">
                {quote.breakdown.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-start justify-between gap-3 text-sm"
                  >
                    <dt className="text-[#52645c]">{row.label}</dt>
                    <dd className="text-right font-medium">{row.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 flex items-center justify-between border-t border-[#edf0e8] pt-4">
                <span className="font-semibold">Subtotal</span>
                <span className="text-xl font-bold">
                  {formatCurrency(quote.subtotal)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#174832] px-4 py-3 text-sm font-bold text-white"
            >
              <Copy size={17} />
              {copied ? "Ringkasan tersalin" : "Copy ringkasan quotation"}
            </button>
          </section>
        ) : (
          <div className="mt-4 rounded-lg border border-[#d9ded2] bg-white p-4">
            <p className="font-bold">Quotation tidak ditemukan</p>
            <p className="mt-2 text-sm text-[#52645c]">
              Data API belum tersedia dan item ini tidak ada di fallback lokal.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

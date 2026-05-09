"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Clipboard,
  Copy,
  ListChecks,
  Loader2,
  PackageCheck,
  Printer,
  ShoppingCart,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  AgentTraceStep,
  formatCurrency,
  loadQuote,
  SavedQuote,
} from "@/components/quote-data";

function AgentWorkflowTraceSummary({ trace }: { trace: AgentTraceStep[] }) {
  return (
    <section className="rounded-lg border border-[#d9ded2] bg-white p-4">
      <div className="flex items-center gap-2">
        <ListChecks className="text-[#174832]" size={18} />
        <h2 className="font-bold">Agent Workflow Trace</h2>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {trace.map((entry, index) => (
          <div key={entry.step} className="rounded-md bg-[#fafbf8] p-3">
            <p className="text-xs font-semibold uppercase text-[#52645c]">
              {index + 1}. {entry.step}
            </p>
            <p className="mt-1 text-sm font-bold">{entry.agent}</p>
            <p className="mt-1 text-sm leading-5 text-[#52645c]">
              {entry.summary}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

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
    const trace =
      quote.agentTrace
        ?.map(
          (entry, index) =>
            `${index + 1}. ${entry.step} - ${entry.agent}: ${entry.summary}`,
        )
        .join("\n") ?? "";
    return `${quote.title}\n${quote.problemSummary}\n\n${quote.diagnosis}\n\n${items}\n\nSubtotal: ${formatCurrency(quote.subtotal)}${trace ? `\n\nAgent Workflow Trace\n${trace}` : ""}`;
  }, [quote]);

  async function handleCopy() {
    if (!summary) return;
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function handlePrint() {
    if (!quote) return;

    const previousTitle = document.title;
    document.title = `Q-Build AI - ${quote.title}`;
    window.print();
    window.setTimeout(() => {
      document.title = previousTitle;
    }, 500);
  }

  return (
    <main className="quote-print-page min-h-screen bg-[#f5f6f1] text-[#171b17]">
      <div className="mx-auto w-full max-w-4xl px-4 py-4">
        <header className="no-print flex items-center justify-between gap-3 border-b border-[#d9ded2] pb-4">
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
          <section className="quote-document mt-4 overflow-hidden rounded-xl border border-[#d9ded2] bg-white shadow-sm">
            <div className="quote-hero bg-[#143f2d] p-5 text-white sm:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-[#cce8d2]">
                    QHomemart AI Agent
                  </p>
                  <h2 className="mt-1 text-2xl font-bold">
                    Q-Build AI Quotation
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-[#e8f5eb]">
                    Rekomendasi material berbasis masalah pelanggan, katalog
                    produk, dan kalkulasi kebutuhan proyek.
                  </p>
                </div>
                <div className="rounded-lg border border-white/20 bg-white/10 p-3 text-sm sm:min-w-52">
                  <p className="text-[#cce8d2]">No. quotation</p>
                  <p className="mt-1 font-mono text-xs font-semibold uppercase">
                    {quote.id.slice(0, 8)}
                  </p>
                  <p className="mt-3 text-[#cce8d2]">Tanggal</p>
                  <p className="mt-1 font-semibold">
                    {new Date(quote.createdAt).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-5 p-4 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-[1fr_240px]">
                <section className="rounded-lg border border-[#d9ded2] bg-[#fafbf8] p-4">
                  <p className="text-xs font-semibold uppercase text-[#52645c]">
                    Proyek
                  </p>
                  <h1 className="mt-1 text-xl font-bold">{quote.title}</h1>
                  <p className="mt-3 text-sm font-bold">Ringkasan masalah</p>
                  <p className="mt-2 text-sm leading-6 text-[#52645c]">
                    {quote.problemSummary}
                  </p>
                  <p className="mt-4 text-sm font-bold">Diagnosis</p>
                  <p className="mt-2 text-sm leading-6">{quote.diagnosis}</p>
                </section>

                <aside className="rounded-lg border border-[#cbd8cb] bg-[#edf5ee] p-4">
                  <p className="text-xs font-semibold uppercase text-[#52645c]">
                    Estimasi subtotal
                  </p>
                  <p className="mt-2 text-2xl font-bold text-[#174832]">
                    {formatCurrency(quote.subtotal)}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[#52645c]">
                    Harga bersifat estimasi demo dan mengikuti data katalog yang
                    tersedia saat quotation dibuat.
                  </p>
                </aside>
              </div>

              <section className="rounded-lg border border-[#d9ded2] bg-white p-4">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="text-[#174832]" size={18} />
                  <h2 className="font-bold">Produk dan quantity</h2>
                </div>

                <div className="quote-mobile-items mt-3 space-y-3">
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

                <table className="quote-print-table mt-4 hidden w-full border-collapse text-sm sm:table">
                  <thead>
                    <tr>
                      <th>Produk</th>
                      <th>Qty</th>
                      <th>Harga satuan</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <p className="font-semibold">{item.name}</p>
                          <p className="mt-1 text-xs text-[#52645c]">
                            {item.reason}
                          </p>
                        </td>
                        <td>
                          {item.quantity} {item.unit}
                        </td>
                        <td>{formatCurrency(item.unitPrice)}</td>
                        <td className="font-semibold">
                          {formatCurrency(item.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className="rounded-lg border border-[#d9ded2] bg-white p-4">
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
                  <span className="text-2xl font-bold text-[#174832]">
                    {formatCurrency(quote.subtotal)}
                  </span>
                </div>
              </section>

              {quote.agentTrace ? (
                <AgentWorkflowTraceSummary trace={quote.agentTrace} />
              ) : null}

              <section className="rounded-lg border border-[#d9ded2] bg-[#fafbf8] p-4 text-sm leading-6 text-[#52645c]">
                <p className="font-semibold text-[#171b17]">Catatan</p>
                <p className="mt-1">
                  Quotation ini dibuat untuk kebutuhan demo Q-Build AI. Validasi
                  kondisi lapangan, stok, dan harga final tetap dilakukan oleh
                  staf QHomemart sebelum pembelian.
                </p>
              </section>

              <div className="no-print grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-[#cbd3c4] bg-white px-4 py-3 text-sm font-bold text-[#174832]"
                >
                  <Copy size={17} />
                  {copied ? "Ringkasan tersalin" : "Copy ringkasan"}
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#174832] px-4 py-3 text-sm font-bold text-white"
                >
                  <Printer size={17} />
                  Export PDF
                </button>
              </div>
            </div>
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

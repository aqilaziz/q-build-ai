"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight, ClipboardList, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { formatCurrency, loadQuotes, SavedQuote } from "@/components/quote-data";

export function QuoteHistory() {
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    loadQuotes().then((items) => {
      if (!isMounted) return;
      setQuotes(items);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#f5f6f1] text-[#171b17]">
      <div className="mx-auto w-full max-w-4xl px-4 py-4">
        <header className="flex items-center justify-between gap-3 border-b border-[#d9ded2] pb-4">
          <Link
            href="/"
            className="inline-flex size-10 items-center justify-center rounded-md border border-[#cbd3c4] bg-white"
            aria-label="Kembali"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase text-[#52645c]">
              Q-Build AI
            </p>
            <h1 className="truncate text-xl font-bold">Saved quotations</h1>
          </div>
          <ClipboardList className="text-[#174832]" size={22} />
        </header>

        {isLoading ? (
          <div className="mt-8 flex items-center gap-2 text-sm text-[#52645c]">
            <Loader2 className="animate-spin" size={17} />
            Memuat quotation...
          </div>
        ) : (
          <section className="mt-4 space-y-3">
            {quotes.map((quote) => (
              <Link
                key={quote.id}
                href={`/quotes/${quote.id}`}
                className="block rounded-lg border border-[#d9ded2] bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{quote.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#52645c]">
                      {quote.problemSummary}
                    </p>
                  </div>
                  <ChevronRight className="mt-1 shrink-0 text-[#52645c]" size={18} />
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#edf0e8] pt-3 text-sm">
                  <span className="text-[#52645c]">
                    {new Date(quote.createdAt).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  <span className="font-bold">{formatCurrency(quote.subtotal)}</span>
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

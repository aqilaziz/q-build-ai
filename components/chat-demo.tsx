"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Calculator,
  Camera,
  CheckCircle2,
  ClipboardList,
  Image as ImageIcon,
  Loader2,
  PackageCheck,
  Save,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { FormEvent, useMemo, useRef, useState } from "react";
import {
  buildRecommendation,
  formatCurrency,
  Recommendation,
  saveQuote,
} from "@/components/quote-data";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageName?: string;
};

const samplePrompts = [
  "Atap kamar saya bocor setelah hujan. Area sekitar 15 meter persegi.",
  "Tembok ruang tamu kusam dan mau dicat ulang, luas sekitar 24 meter.",
  "Ada retakan halus di dak dan air merembes saat hujan deras.",
];

const initialMessages: ChatMessage[] = [
  {
    id: "assistant-intro",
    role: "assistant",
    content:
      "Masukkan masalah rumah atau unggah foto. Demo ini akan menampilkan diagnosis, produk, kalkulasi quantity, subtotal, dan opsi simpan quotation.",
  },
];

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ChatDemo() {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState(samplePrompts[0]);
  const [attachedImage, setAttachedImage] = useState<File | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(
    buildRecommendation(samplePrompts[0]),
  );
  const [streamingText, setStreamingText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [savedId, setSavedId] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const imageInputRef = useRef<HTMLInputElement>(null);

  const toolSteps = useMemo(
    () => [
      { icon: Search, label: "Klasifikasi masalah + product RAG" },
      { icon: Calculator, label: "Kalkulasi kebutuhan material" },
      { icon: PackageCheck, label: "Susun quotation belanja" },
    ],
    [],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = input.trim();

    if (!prompt && !attachedImage) {
      setError("Tulis masalah rumah atau unggah foto terlebih dahulu.");
      return;
    }

    setError("");
    setSavedId("");
    setSaveState("idle");
    setIsLoading(true);
    setStreamingText("");
    setRecommendation(null);

    const userContent = prompt || "Saya unggah foto masalah rumah.";
    setMessages((current) => [
      ...current,
      {
        id: createId("user"),
        role: "user",
        content: userContent,
        imageName: attachedImage?.name,
      },
    ]);

    const nextRecommendation = buildRecommendation(
      `${userContent} ${attachedImage ? "foto kerusakan bangunan" : ""}`,
    );
    const responseText = `Diagnosis: ${nextRecommendation.diagnosis} Rekomendasi sudah dihitung dari katalog demo QHomemart dengan subtotal ${formatCurrency(nextRecommendation.subtotal)}.`;
    const chunks = responseText.match(/.{1,38}(\s|$)/g) ?? [responseText];

    for (const chunk of chunks) {
      await new Promise((resolve) => setTimeout(resolve, 90));
      setStreamingText((current) => `${current}${chunk}`);
    }

    setMessages((current) => [
      ...current,
      {
        id: createId("assistant"),
        role: "assistant",
        content: responseText,
      },
    ]);
    setRecommendation(nextRecommendation);
    setInput("");
    setAttachedImage(null);
    setStreamingText("");
    setIsLoading(false);
  }

  async function handleSaveQuote() {
    if (!recommendation) return;

    setSaveState("saving");
    setError("");

    try {
      const saved = await saveQuote(recommendation);
      setSavedId(saved.id);
      setSaveState("saved");
    } catch {
      setError("Quotation belum bisa disimpan. Coba lagi sebentar.");
      setSaveState("idle");
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f6f1] text-[#171b17]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col">
        <header className="sticky top-0 z-20 border-b border-[#d9ded2] bg-[#f5f6f1]/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-[#52645c]">
                QHomemart AI Agent
              </p>
              <h1 className="truncate text-lg font-bold">Q-Build AI Demo</h1>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/quotes"
                className="inline-flex size-10 items-center justify-center rounded-md border border-[#cbd3c4] bg-white text-[#26342b]"
                aria-label="Saved quotations"
              >
                <ClipboardList size={19} />
              </Link>
              <Link
                href="/login"
                className="hidden rounded-md bg-[#174832] px-3 py-2 text-sm font-semibold text-white sm:inline-flex"
              >
                Demo login
              </Link>
            </div>
          </div>
        </header>

        <div className="grid flex-1 gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="flex min-h-[calc(100vh-104px)] flex-col overflow-hidden rounded-lg border border-[#d9ded2] bg-white">
            <div className="border-b border-[#e5e8df] px-4 py-3">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {samplePrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setInput(prompt)}
                    className="shrink-0 rounded-md border border-[#d9ded2] bg-[#fafbf8] px-3 py-2 text-left text-xs font-medium text-[#26342b]"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={
                    message.role === "user"
                      ? "ml-auto max-w-[88%] rounded-lg bg-[#174832] p-3 text-white"
                      : "max-w-[92%] rounded-lg bg-[#eef2ea] p-3 text-[#1d251f]"
                  }
                >
                  <p className="text-xs font-semibold uppercase opacity-75">
                    {message.role === "user" ? "Customer" : "Q-Build AI"}
                  </p>
                  <p className="mt-1 text-sm leading-6">{message.content}</p>
                  {message.imageName ? (
                    <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-md bg-white/15 px-2 py-1 text-xs">
                      <ImageIcon size={14} />
                      <span className="truncate">{message.imageName}</span>
                    </div>
                  ) : null}
                </div>
              ))}

              {isLoading ? (
                <div className="max-w-[92%] rounded-lg bg-[#eef2ea] p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#174832]">
                    <Loader2 className="animate-spin" size={16} />
                    Menganalisis...
                  </div>
                  <div className="mt-3 grid gap-2">
                    {toolSteps.map((step) => {
                      const Icon = step.icon;
                      return (
                        <div
                          key={step.label}
                          className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-xs font-medium text-[#4d5b50]"
                        >
                          <Icon size={15} />
                          {step.label}
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#26342b]">
                    {streamingText || "Membaca masalah dan menyiapkan hasil..."}
                  </p>
                </div>
              ) : null}
            </div>

            {error ? (
              <div className="mx-4 mb-3 flex items-start gap-2 rounded-md border border-[#efb8a8] bg-[#fff4ef] px-3 py-2 text-sm text-[#8a321d]">
                <AlertTriangle className="mt-0.5 shrink-0" size={16} />
                <span>{error}</span>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="border-t border-[#e5e8df] p-3">
              {attachedImage ? (
                <div className="mb-2 flex items-center justify-between gap-2 rounded-md bg-[#eef5fb] px-3 py-2 text-sm text-[#25476a]">
                  <span className="min-w-0 truncate">
                    Foto siap dianalisis: {attachedImage.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAttachedImage(null)}
                    className="shrink-0"
                    aria-label="Hapus foto"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : null}

              <div className="flex gap-2">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) =>
                    setAttachedImage(event.currentTarget.files?.[0] ?? null)
                  }
                />
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="flex size-11 shrink-0 items-center justify-center rounded-md border border-[#cbd3c4] text-[#26342b]"
                  aria-label="Upload foto"
                >
                  <Camera size={20} />
                </button>
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-[#cbd3c4] px-3 text-sm outline-none focus:border-[#174832]"
                  placeholder="Contoh: atap bocor 15 meter persegi"
                  aria-label="Pesan renovasi"
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex size-11 shrink-0 items-center justify-center rounded-md bg-[#174832] text-white disabled:opacity-60"
                  aria-label="Kirim"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                </button>
              </div>
            </form>
          </section>

          <aside className="space-y-4">
            <section className="rounded-lg border border-[#d9ded2] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-[#52645c]">
                    Rekomendasi
                  </p>
                  <h2 className="text-lg font-bold">
                    {recommendation?.title ?? "Belum ada hasil"}
                  </h2>
                </div>
                <Sparkles className="text-[#b86b00]" size={20} />
              </div>

              {recommendation ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-md bg-[#eef2ea] p-3">
                    <p className="text-xs font-semibold uppercase text-[#52645c]">
                      Diagnosis
                    </p>
                    <p className="mt-1 text-sm leading-6">
                      {recommendation.diagnosis}
                    </p>
                  </div>

                  <div className="space-y-2">
                    {recommendation.items.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-md border border-[#e1e5dc] p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{item.name}</p>
                            <p className="mt-1 text-xs text-[#52645c]">
                              {item.category}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-bold">
                            {formatCurrency(item.lineTotal)}
                          </p>
                        </div>
                        <div className="mt-3 flex items-center justify-between rounded-md bg-[#fafbf8] px-3 py-2 text-sm">
                          <span>
                            {item.quantity} {item.unit} x{" "}
                            {formatCurrency(item.unitPrice)}
                          </span>
                          <CheckCircle2 className="text-[#287348]" size={16} />
                        </div>
                        <p className="mt-2 text-sm leading-5 text-[#52645c]">
                          {item.reason}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-md border border-[#e1e5dc] p-3">
                    <p className="text-sm font-bold">Breakdown kalkulasi</p>
                    <dl className="mt-2 space-y-2">
                      {recommendation.breakdown.map((row) => (
                        <div
                          key={row.label}
                          className="flex items-start justify-between gap-3 text-sm"
                        >
                          <dt className="text-[#52645c]">{row.label}</dt>
                          <dd className="text-right font-medium">{row.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>

                  <div className="flex items-center justify-between border-t border-[#e5e8df] pt-4">
                    <span className="text-sm font-semibold">Subtotal</span>
                    <span className="text-xl font-bold">
                      {formatCurrency(recommendation.subtotal)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveQuote}
                    disabled={saveState === "saving"}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#174832] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {saveState === "saving" ? (
                      <Loader2 className="animate-spin" size={17} />
                    ) : (
                      <Save size={17} />
                    )}
                    {saveState === "saved" ? "Quotation tersimpan" : "Simpan quotation"}
                  </button>

                  {savedId ? (
                    <Link
                      href={`/quotes/${savedId}`}
                      className="block rounded-md border border-[#cbd3c4] px-4 py-3 text-center text-sm font-semibold text-[#174832]"
                    >
                      Buka detail quotation
                    </Link>
                  ) : null}
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6 text-[#52645c]">
                  Kirim prompt demo untuk melihat diagnosis, produk, quantity,
                  alasan, subtotal, dan breakdown kalkulasi.
                </p>
              )}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

"use client";

import type { ReactNode } from "react";

type TraceFieldProps = {
  label: "Input" | "Output" | "Decision";
  value: string;
  agent: string;
};

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseJson(value: string) {
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function formatCurrency(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? `Rp ${value.toLocaleString("id-ID")}`
    : "-";
}

function formatScalar(value: unknown) {
  if (typeof value === "number") return value.toLocaleString("id-ID");
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  if (typeof value === "string") return value || "-";
  if (value === null || value === undefined) return "-";
  return JSON.stringify(value);
}

function pillClass(tone: "success" | "warning" | "neutral") {
  if (tone === "success") return "border-[#bed7c4] bg-[#edf5ee] text-[#174832]";
  if (tone === "warning") return "border-[#efb8a8] bg-[#fff4ef] text-[#8a321d]";
  return "border-[#d9ded2] bg-white text-[#52645c]";
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "success" | "warning" | "neutral";
}) {
  return (
    <span className={`rounded-md border px-2 py-1 text-[11px] font-bold ${pillClass(tone)}`}>
      {children}
    </span>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-[#edf0e8] bg-white/70 p-2">
      <p className="text-[11px] font-bold uppercase text-[#52645c]">{title}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function TraceText({ children }: { children: string }) {
  return (
    <p className="mt-1 min-w-0 whitespace-pre-wrap break-words leading-5 [overflow-wrap:anywhere]">
      {children}
    </p>
  );
}

function getRecord(value: JsonRecord, key: string) {
  const child = value[key];
  return isRecord(child) ? child : null;
}

function getArray(value: JsonRecord, key: string) {
  const child = value[key];
  return Array.isArray(child) ? child : [];
}

function KeyValueGrid({ rows }: { rows: Array<[string, unknown]> }) {
  return (
    <dl className="grid gap-1">
      {rows.map(([label, value], index) => (
        <div key={`${label}-${index}`} className="grid grid-cols-[88px_1fr] gap-2 text-[11px]">
          <dt className="font-semibold text-[#52645c]">{label}</dt>
          <dd className="min-w-0 break-words text-[#171b17] [overflow-wrap:anywhere]">
            {formatScalar(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ItemsTable({ items }: { items: unknown[] }) {
  const rows = items.filter(isRecord);
  if (rows.length === 0) return <p className="text-[11px] text-[#52645c]">Tidak ada item.</p>;

  return (
    <div className="overflow-hidden rounded-md border border-[#edf0e8]">
      <div className="grid grid-cols-[1fr_46px_72px] gap-2 bg-[#edf5ee] px-2 py-1 text-[10px] font-bold uppercase text-[#52645c]">
        <span>Produk</span>
        <span>Qty</span>
        <span>Total</span>
      </div>
      <div className="divide-y divide-[#edf0e8]">
        {rows.map((item, index) => (
          <div
            key={`${String(item.name ?? "item")}-${index}`}
            className="grid grid-cols-[1fr_46px_72px] gap-2 px-2 py-1.5 text-[11px]"
          >
            <div className="min-w-0">
              <p className="break-words font-semibold [overflow-wrap:anywhere]">
                {formatScalar(item.name)}
              </p>
              <p className="mt-0.5 text-[#52645c]">{formatScalar(item.unit)}</p>
            </div>
            <span>{formatScalar(item.quantity)}</span>
            <span>{formatCurrency(item.lineTotal)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InboxList({ inbox }: { inbox: unknown[] }) {
  const rows = inbox.filter(isRecord);
  if (rows.length === 0) return null;

  return (
    <Section title="Handoff masuk">
      <div className="space-y-1">
        {rows.slice(0, 3).map((message, index) => (
          <div key={index} className="rounded bg-[#fafbf8] px-2 py-1 text-[11px]">
            <p className="font-semibold text-[#174832]">
              {formatScalar(message.from)} {"->"} Critic
            </p>
            <p className="text-[#52645c]">{formatScalar(message.type)}</p>
            <p className="mt-0.5 break-words [overflow-wrap:anywhere]">
              {formatScalar(message.summary)}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function CriticInput({ data }: { data: JsonRecord }) {
  const audit = getRecord(data, "deterministicAudit");
  const intake = getRecord(data, "intake");
  const items = getArray(data, "items");
  const inbox = getArray(data, "inbox");
  const subtotalOk = audit?.subtotalConsistent === true;

  return (
    <div className="mt-1 space-y-2">
      {audit ? (
        <Section title="Audit subtotal">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={subtotalOk ? "success" : "warning"}>
              {subtotalOk ? "Subtotal cocok" : "Subtotal perlu cek"}
            </Badge>
            <Badge>Total item {formatCurrency(audit.lineTotal)}</Badge>
            <Badge>Subtotal {formatCurrency(audit.subtotal)}</Badge>
          </div>
        </Section>
      ) : null}
      {intake ? (
        <Section title="Intake">
          <KeyValueGrid
            rows={[
              ["Intent", intake.intent],
              ["Area", typeof intake.areaM2 === "number" ? `${intake.areaM2} m2` : intake.areaM2],
              ["Warna", intake.color],
              ["Budget", intake.budgetPreference],
            ]}
          />
        </Section>
      ) : null}
      <Section title="Item quotation">
        <ItemsTable items={items} />
      </Section>
      <InboxList inbox={inbox} />
      {typeof data.calculator === "string" ? (
        <Section title="Kalkulator">
          <TraceText>{data.calculator}</TraceText>
        </Section>
      ) : null}
    </div>
  );
}

function CriticOutput({ data }: { data: JsonRecord }) {
  const passed = data.passed === true;
  const audit = getRecord(data, "deterministicAudit");
  const issues = getArray(data, "issues").filter((issue): issue is string => typeof issue === "string");

  return (
    <div className="mt-1 space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <Badge tone={passed ? "success" : "warning"}>
          {passed ? "Validasi lolos" : "Perlu revisi"}
        </Badge>
        {typeof data.confidence === "number" ? (
          <Badge>Confidence {Math.round(data.confidence * 100)}%</Badge>
        ) : null}
      </div>
      {typeof data.summary === "string" ? (
        <Section title="Ringkasan">
          <TraceText>{data.summary}</TraceText>
        </Section>
      ) : null}
      <Section title="Isu">
        {issues.length > 0 ? (
          <ul className="list-disc space-y-1 pl-4 text-[11px]">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-[#174832]">Tidak ada isu.</p>
        )}
      </Section>
      {audit ? (
        <Section title="Audit deterministik">
          <KeyValueGrid
            rows={[
              ["Subtotal", audit.subtotalConsistent === true ? "Cocok" : "Tidak cocok"],
              ["Total item", formatCurrency(audit.lineTotal)],
              ["Subtotal", formatCurrency(audit.subtotal)],
            ]}
          />
        </Section>
      ) : null}
    </div>
  );
}

function GenericJson({ data }: { data: JsonRecord }) {
  const rows = Object.entries(data).filter(
    ([, value]) => typeof value !== "object" || value === null,
  );
  if (rows.length === 0) {
    return <TraceText>{JSON.stringify(data, null, 2)}</TraceText>;
  }

  return (
    <div className="mt-1">
      <KeyValueGrid rows={rows} />
    </div>
  );
}

export function AgentTraceField({ label, value, agent }: TraceFieldProps) {
  const parsed = parseJson(value);
  const isCritic = agent === "Critic Agent";

  return (
    <div className="min-w-0 rounded-md bg-[#fafbf8] p-2">
      <p className="font-bold uppercase text-[#52645c]">{label}</p>
      {parsed && isCritic && label === "Input" ? (
        <CriticInput data={parsed} />
      ) : parsed && isCritic && label === "Output" ? (
        <CriticOutput data={parsed} />
      ) : parsed ? (
        <GenericJson data={parsed} />
      ) : (
        <TraceText>{value}</TraceText>
      )}
    </div>
  );
}

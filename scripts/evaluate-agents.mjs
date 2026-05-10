const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_TIMEOUT_MS = 120000;

const baseUrl = (process.env.EVAL_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
const timeoutMs = Number(process.env.EVAL_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);

const cases = [
  {
    id: "roof-waterproofing",
    prompt:
      "Atap kamar saya bocor setelah hujan deras. Luas area sekitar 15 meter persegi. Preferensi standar. Saya harus beli apa dan kira-kira habis berapa?",
    expect: {
      type: "recommendation",
      intent: "waterproofing",
      areaM2: 15,
      titleIncludes: "15",
      minTraceSteps: 7,
    },
  },
  {
    id: "pipe-half-meter",
    prompt: "Pipa wastafel bocor setengah meter, standar.",
    expect: {
      type: "recommendation",
      intent: "plumbing",
      lengthM: 0.5,
      titleIncludes: "0.5",
      minTraceSteps: 7,
    },
  },
  {
    id: "pipe-quarter-meter",
    prompt: "Sambungan pipa bocor seperempat meter, standar.",
    expect: {
      type: "recommendation",
      intent: "plumbing",
      lengthM: 0.25,
      titleIncludes: "0.25",
      minTraceSteps: 7,
    },
  },
  {
    id: "paint-krem",
    prompt: "Mau cat dinding 12 m2 warna krem standar.",
    expect: {
      type: "recommendation",
      intent: "paint",
      areaM2: 12,
      color: "krem",
      titleIncludes: "krem",
      minTraceSteps: 7,
    },
  },
  {
    id: "wall-repair",
    prompt: "Dinding rembes dan retak rambut, luas sekitar 10 m2. Preferensi standar.",
    expect: {
      type: "recommendation",
      intent: "wall_repair",
      areaM2: 10,
      titleIncludes: "10",
      minTraceSteps: 7,
    },
  },
  {
    id: "clarify-missing-area",
    prompt: "Atap saya bocor, preferensi standar.",
    expect: {
      type: "clarification",
      messageIncludes: "luas",
    },
  },
  {
    id: "unsupported-product",
    prompt: "Kipas angin kamar rusak, mau beli yang baru.",
    expect: {
      type: "unavailable",
      messageIncludes: "katalog",
    },
  },
];

function nearlyEqual(a, b) {
  return typeof a === "number" && Math.abs(a - b) < 0.01;
}

function includesText(value, expected) {
  return String(value || "").toLowerCase().includes(String(expected).toLowerCase());
}

function assertCase(payload, expected) {
  const failures = [];
  const recommendation = payload.recommendation;
  const intake = payload.intake || {};
  const traceSteps = Array.isArray(recommendation?.agentTrace)
    ? recommendation.agentTrace
    : Array.isArray(recommendation?.agentTrace?.steps)
      ? recommendation.agentTrace.steps
      : [];

  if (payload.type !== expected.type) {
    failures.push(`type expected ${expected.type}, got ${payload.type}`);
  }

  if (expected.intent && intake.intent !== expected.intent) {
    failures.push(`intent expected ${expected.intent}, got ${intake.intent}`);
  }

  if (expected.areaM2 !== undefined && !nearlyEqual(intake.areaM2, expected.areaM2)) {
    failures.push(`areaM2 expected ${expected.areaM2}, got ${intake.areaM2}`);
  }

  if (expected.lengthM !== undefined && !nearlyEqual(intake.lengthM, expected.lengthM)) {
    failures.push(`lengthM expected ${expected.lengthM}, got ${intake.lengthM}`);
  }

  if (expected.color && !includesText(intake.color, expected.color)) {
    failures.push(`color expected ${expected.color}, got ${intake.color}`);
  }

  if (expected.titleIncludes && !includesText(recommendation?.title, expected.titleIncludes)) {
    failures.push(`title expected to include ${expected.titleIncludes}, got ${recommendation?.title}`);
  }

  if (expected.messageIncludes && !includesText(payload.message, expected.messageIncludes)) {
    failures.push(`message expected to include ${expected.messageIncludes}, got ${payload.message}`);
  }

  if (expected.minTraceSteps) {
    if (traceSteps.length < expected.minTraceSteps) {
      failures.push(`agentTrace steps expected >= ${expected.minTraceSteps}, got ${traceSteps.length}`);
    }
  }

  return failures;
}

async function callRecommendation(prompt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(`${baseUrl}/api/recommendation`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });

    const text = await response.text();
    const durationMs = Date.now() - startedAt;
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`Non-JSON response (${response.status}): ${text.slice(0, 200)}`);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${payload.error || text.slice(0, 200)}`);
    }

    return { payload, durationMs };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  console.log(`Q-Build AI agent evaluation`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Cases: ${cases.length}`);
  console.log("");

  const results = [];

  for (const item of cases) {
    try {
      const { payload, durationMs } = await callRecommendation(item.prompt);
      const failures = assertCase(payload, item.expect);
      const pass = failures.length === 0;
      results.push({ id: item.id, pass, durationMs, failures });

      const intent = payload.intake?.intent || "-";
      const title = payload.recommendation?.title || payload.message || "-";
      console.log(
        `${pass ? "PASS" : "FAIL"} ${item.id} (${durationMs} ms) type=${payload.type} intent=${intent}`,
      );
      console.log(`  ${title}`);
      for (const failure of failures) console.log(`  - ${failure}`);
    } catch (error) {
      results.push({
        id: item.id,
        pass: false,
        durationMs: null,
        failures: [error instanceof Error ? error.message : String(error)],
      });
      console.log(`FAIL ${item.id}`);
      console.log(`  - ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const passed = results.filter((result) => result.pass).length;
  const durations = results
    .map((result) => result.durationMs)
    .filter((value) => typeof value === "number");
  const averageMs = durations.length
    ? Math.round(durations.reduce((total, value) => total + value, 0) / durations.length)
    : 0;

  console.log("");
  console.log(`Summary: ${passed}/${results.length} passed, average ${averageMs} ms`);

  if (passed !== results.length) {
    process.exitCode = 1;
  }
}

await main();

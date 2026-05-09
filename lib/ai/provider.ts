import { createOpenAI } from "@ai-sdk/openai";

const DEFAULT_CHAT_MODEL = "gpt-4o-mini";
const DEFAULT_OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";

function optionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function getAIProvider() {
  return createOpenAI({
    apiKey: optionalEnv("AI_API_KEY") ?? optionalEnv("OPENAI_API_KEY"),
    baseURL: optionalEnv("AI_BASE_URL") ?? optionalEnv("OPENAI_BASE_URL"),
    name: optionalEnv("AI_PROVIDER_NAME") ?? "openai-compatible",
  });
}

export function getChatModel() {
  const provider = getAIProvider();
  return provider.chat(optionalEnv("AI_MODEL") ?? optionalEnv("OPENAI_MODEL") ?? DEFAULT_CHAT_MODEL);
}

export function getEmbeddingConfig() {
  const model =
    optionalEnv("AI_EMBEDDING_MODEL") ??
    optionalEnv("OPENAI_EMBEDDING_MODEL") ??
    (hasCustomAIConfig() ? undefined : DEFAULT_OPENAI_EMBEDDING_MODEL);

  const apiKey =
    optionalEnv("AI_EMBEDDING_API_KEY") ??
    optionalEnv("AI_API_KEY") ??
    optionalEnv("OPENAI_API_KEY");

  const baseURL =
    optionalEnv("AI_EMBEDDING_BASE_URL") ??
    optionalEnv("AI_BASE_URL") ??
    optionalEnv("OPENAI_BASE_URL");

  if (!model || !apiKey) {
    return null;
  }

  return { model, apiKey, baseURL };
}

export function getEmbeddingModel() {
  const config = getEmbeddingConfig();
  if (!config) {
    return null;
  }

  return createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    name: "openai-compatible-embedding",
  }).embedding(config.model);
}

function hasCustomAIConfig() {
  return Boolean(
    optionalEnv("AI_BASE_URL") ||
      optionalEnv("AI_API_KEY") ||
      optionalEnv("AI_MODEL"),
  );
}

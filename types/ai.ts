import type { UIMessage } from "ai";

export type ChatImageInput = {
  url: string;
  mediaType?: string;
  filename?: string;
};

export type ChatRequestBody = {
  messages?: UIMessage[];
  message?: string;
  image?: ChatImageInput;
  images?: ChatImageInput[];
};

export type ToolFailure = {
  ok: false;
  error: string;
};

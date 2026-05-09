import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type FileUIPart,
  type UIMessage,
} from "ai";
import { getChatModel } from "@/lib/ai/provider";
import { createQBuildTools } from "@/lib/ai/tools";
import { qBuildSystemPrompt } from "@/lib/ai/prompt";
import type { ChatImageInput, ChatRequestBody } from "@/types/ai";

export const maxDuration = 30;

function toFilePart(image: ChatImageInput): FileUIPart {
  return {
    type: "file",
    url: image.url,
    mediaType: image.mediaType ?? "image/jpeg",
    filename: image.filename,
  };
}

function normalizeMessages(body: ChatRequestBody): UIMessage[] {
  const extraImages = [body.image, ...(body.images ?? [])].filter(
    Boolean,
  ) as ChatImageInput[];

  if (body.messages?.length) {
    const messages = body.messages.map((message) => ({
      ...message,
      parts: [...message.parts],
    }));

    if (extraImages.length > 0) {
      const lastUserIndex = messages.findLastIndex(
        (message) => message.role === "user",
      );

      if (lastUserIndex >= 0) {
        messages[lastUserIndex] = {
          ...messages[lastUserIndex],
          parts: [
            ...messages[lastUserIndex].parts,
            ...extraImages.map(toFilePart),
          ],
        };
      }
    }

    return messages;
  }

  const text = body.message?.trim();
  if (!text && extraImages.length === 0) {
    throw new Error("Body harus berisi messages, message, atau image.");
  }

  return [
    {
      id: crypto.randomUUID(),
      role: "user",
      parts: [
        ...(text ? [{ type: "text" as const, text }] : []),
        ...extraImages.map(toFilePart),
      ],
    },
  ];
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequestBody;
    const messages = normalizeMessages(body);

    const result = streamText({
      model: getChatModel(),
      system: qBuildSystemPrompt,
      messages: await convertToModelMessages(messages),
      tools: createQBuildTools(request),
      stopWhen: stepCountIs(8),
    });

    return result.toUIMessageStreamResponse({
      onError(error) {
        return error instanceof Error
          ? error.message
          : "Terjadi error saat memproses chat.";
      },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Request chat tidak valid.",
      },
      { status: 400 },
    );
  }
}

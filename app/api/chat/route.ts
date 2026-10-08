import { google } from "@ai-sdk/google";
import { streamText, type ModelMessage } from "ai";
import { buildSystemPrompt } from "../../ai/system-prompt";
import {
  MAX_INJECTED_PERSONA_EXAMPLES,
  MAX_PERSONA_EXAMPLES,
  type PersonaExample,
} from "../../ai/persona-examples";
import type { PersonaSettings } from "../../persona-engine";
import { classifyGeminiError } from "../../chat-failure";

export const maxDuration = 30;

const MAX_MESSAGES = 16;
const MAX_MESSAGE_LENGTH = 4_000;
const MAX_TOTAL_LENGTH = 20_000;
const MAX_EXAMPLE_PROMPT_LENGTH = 1_200;
const MAX_EXAMPLE_RESPONSE_LENGTH = 2_000;
const MAX_EXAMPLE_NOTE_LENGTH = 500;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_REQUESTS = 12;
const requestBuckets = new Map<string, { count: number; resetAt: number }>();

const DEFAULT_SETTINGS: PersonaSettings = {
  honesty: 85,
  talkativeness: 75,
  empathy: 80,
  designPriority: 90,
};

const clampSetting = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(100, Math.max(20, Math.round(value)))
    : fallback;

const readSettings = (value: unknown): PersonaSettings => {
  if (!value || typeof value !== "object") return DEFAULT_SETTINGS;
  const candidate = value as Record<string, unknown>;
  return {
    honesty: clampSetting(candidate.honesty, DEFAULT_SETTINGS.honesty),
    talkativeness: clampSetting(
      candidate.talkativeness,
      DEFAULT_SETTINGS.talkativeness,
    ),
    empathy: clampSetting(candidate.empathy, DEFAULT_SETTINGS.empathy),
    designPriority: clampSetting(
      candidate.designPriority,
      DEFAULT_SETTINGS.designPriority,
    ),
  };
};

const readMessages = (value: unknown): ModelMessage[] | null => {
  if (!Array.isArray(value)) return null;

  let totalLength = 0;
  const messages: ModelMessage[] = [];
  for (const item of value.slice(-MAX_MESSAGES)) {
    if (!item || typeof item !== "object") return null;
    const candidate = item as Record<string, unknown>;
    if (
      (candidate.role !== "user" && candidate.role !== "assistant") ||
      typeof candidate.content !== "string"
    ) {
      return null;
    }

    const content = candidate.content.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!content) continue;
    totalLength += content.length;
    if (totalLength > MAX_TOTAL_LENGTH) return null;
    messages.push({ role: candidate.role, content });
  }

  return messages.length > 0 ? messages : null;
};

const readPersonaExamples = (value: unknown): PersonaExample[] => {
  if (!Array.isArray(value)) return [];

  const examples: PersonaExample[] = [];
  for (const item of value.slice(-MAX_PERSONA_EXAMPLES)) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Record<string, unknown>;
    if (
      candidate.approved !== true ||
      (candidate.kind !== "same" && candidate.kind !== "correction") ||
      typeof candidate.prompt !== "string" ||
      typeof candidate.response !== "string"
    ) {
      continue;
    }

    const prompt = candidate.prompt.trim().slice(0, MAX_EXAMPLE_PROMPT_LENGTH);
    const response = candidate.response
      .trim()
      .slice(0, MAX_EXAMPLE_RESPONSE_LENGTH);
    if (!prompt || !response) continue;

    const reasons = Array.isArray(candidate.reasons)
      ? candidate.reasons
          .filter((reason): reason is string => typeof reason === "string")
          .map((reason) => reason.trim().slice(0, 80))
          .filter(Boolean)
          .slice(0, 5)
      : [];

    examples.push({
      id: typeof candidate.id === "string" ? candidate.id.slice(0, 100) : "",
      messageId:
        typeof candidate.messageId === "string"
          ? candidate.messageId.slice(0, 100)
          : "",
      kind: candidate.kind,
      prompt,
      response,
      reasons,
      note:
        typeof candidate.note === "string"
          ? candidate.note.trim().slice(0, MAX_EXAMPLE_NOTE_LENGTH)
          : "",
      approved: true,
      createdAt:
        typeof candidate.createdAt === "string"
          ? candidate.createdAt.slice(0, 40)
          : "",
    });
  }

  return examples.slice(-MAX_INJECTED_PERSONA_EXAMPLES);
};

const isSameOrigin = (request: Request) => {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
};

const isRateLimited = (request: Request) => {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const key = forwardedFor || "anonymous";
  const now = Date.now();
  const bucket = requestBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    requestBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_REQUESTS;
};

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json(
      { code: "FORBIDDEN", message: "Cross-origin requests are not allowed." },
      { status: 403 },
    );
  }

  if (isRateLimited(request)) {
    return Response.json(
      { code: "RATE_LIMITED", message: "Please wait before trying again." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return Response.json(
      { code: "AI_NOT_CONFIGURED", message: "Gemini API key is not configured." },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const messages = readMessages(body.messages);
    const personaExamples = readPersonaExamples(body.personaExamples);
    if (!messages) {
      return Response.json(
        { code: "INVALID_REQUEST", message: "A valid conversation is required." },
        { status: 400 },
      );
    }

    const result = streamText({
      model: google(process.env.GEMINI_MODEL ?? "gemini-3.6-flash"),
      system: buildSystemPrompt(readSettings(body.settings), personaExamples),
      messages,
      temperature: 0.85,
      maxOutputTokens: 1_200,
      providerOptions: {
        google: { thinkingConfig: { includeThoughts: true } },
      },
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const part of result.fullStream) {
            if (part.type === "text-delta" || part.type === "reasoning-delta") {
              controller.enqueue(encoder.encode(`${JSON.stringify({
                type: part.type === "text-delta" ? "text" : "summary",
                text: part.text,
              })}\n`));
            } else if (part.type === "error") {
              controller.enqueue(encoder.encode(`${JSON.stringify({
                type: "error",
                code: classifyGeminiError(part.error),
              })}\n`));
            }
          }
        } catch (error) {
          console.error("Gemini stream failed", error);
          controller.enqueue(encoder.encode(`${JSON.stringify({
            type: "error",
            code: classifyGeminiError(error),
          })}\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Light-Model": process.env.GEMINI_MODEL ?? "gemini-3.6-flash",
      },
    });
  } catch (error) {
    console.error("Gemini chat request failed", error);
    return Response.json(
      { code: "AI_REQUEST_FAILED", message: "Gemini request failed." },
      { status: 502 },
    );
  }
}

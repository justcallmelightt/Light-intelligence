import { del, get, put } from "@vercel/blob";
import { readBoundedJson } from "../read-bounded-json";
import { isRateLimited, isSameOrigin } from "../request-security";
import {
  MAX_PERSONA_EXAMPLES,
  type PersonaExample,
} from "../../ai/persona-examples";

const PROFILE_ID_PATTERN = /^[a-z0-9-]{16,128}$/i;
const MAX_PROMPT_LENGTH = 1_200;
const MAX_RESPONSE_LENGTH = 2_000;
const MAX_NOTE_LENGTH = 500;
const MAX_REQUEST_BYTES = 128 * 1024;
const privateHeaders = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

// Vercel project 연결은 BLOB_STORE_ID를 자동 주입하고, Vercel Runtime에서는
// OIDC 자격 증명으로 private Blob을 읽고 쓸 수 있다. 로컬 개발은 token을 사용한다.
const storeIsConfigured = () =>
  Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

const readProfileId = (value: unknown) =>
  typeof value === "string" && PROFILE_ID_PATTERN.test(value) ? value : null;

const readExamples = (value: unknown): PersonaExample[] => {
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

    const prompt = candidate.prompt.trim().slice(0, MAX_PROMPT_LENGTH);
    const response = candidate.response.trim().slice(0, MAX_RESPONSE_LENGTH);
    if (!prompt || !response) continue;

    examples.push({
      id: typeof candidate.id === "string" ? candidate.id.slice(0, 100) : "",
      messageId:
        typeof candidate.messageId === "string"
          ? candidate.messageId.slice(0, 100)
          : "",
      kind: candidate.kind,
      prompt,
      response,
      reasons: Array.isArray(candidate.reasons)
        ? candidate.reasons
            .filter((reason): reason is string => typeof reason === "string")
            .map((reason) => reason.trim().slice(0, 80))
            .filter(Boolean)
            .slice(0, 5)
        : [],
      note:
        typeof candidate.note === "string"
          ? candidate.note.trim().slice(0, MAX_NOTE_LENGTH)
          : "",
      approved: true,
      createdAt:
        typeof candidate.createdAt === "string"
          ? candidate.createdAt.slice(0, 40)
          : "",
    });
  }

  return examples.slice(-MAX_PERSONA_EXAMPLES);
};

const pathnameFor = (profileId: string) =>
  `light-intelligence/persona-feedback/${profileId}.json`;

const unavailable = () =>
  Response.json(
    { code: "STORE_UNAVAILABLE", message: "Persona feedback storage is unavailable." },
    { status: 503, headers: privateHeaders },
  );

export async function GET(request: Request) {
  if (!storeIsConfigured()) return unavailable();

  const profileId = readProfileId(
    new URL(request.url).searchParams.get("profileId"),
  );
  if (!profileId) {
    return Response.json({ code: "INVALID_PROFILE" }, { status: 400, headers: privateHeaders });
  }

  try {
    const result = await get(pathnameFor(profileId), {
      access: "private",
      useCache: false,
    });
    if (!result || result.statusCode !== 200) {
      return Response.json({ examples: [] }, { headers: { "Cache-Control": "no-store" } });
    }

    const payload = JSON.parse(
      await new Response(result.stream).text(),
    ) as { examples?: unknown };
    return Response.json(
      { examples: readExamples(payload.examples) },
      { headers: privateHeaders },
    );
  } catch (error) {
    console.error("Persona feedback read failed", error);
    return unavailable();
  }
}

export async function PUT(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ code: "FORBIDDEN" }, { status: 403, headers: privateHeaders });
  }
  if (isRateLimited(request, "persona-write", 20)) {
    return Response.json(
      { code: "RATE_LIMITED" },
      { status: 429, headers: { ...privateHeaders, "Retry-After": "60" } },
    );
  }
  if (!storeIsConfigured()) return unavailable();

  try {
    const parsed = await readBoundedJson(request, MAX_REQUEST_BYTES);
    if (!parsed.ok) {
      return Response.json(
        { code: parsed.tooLarge ? "REQUEST_TOO_LARGE" : "INVALID_REQUEST" },
        { status: parsed.tooLarge ? 413 : 400, headers: privateHeaders },
      );
    }
    if (!parsed.value || typeof parsed.value !== "object" || Array.isArray(parsed.value)) {
      return Response.json({ code: "INVALID_REQUEST" }, { status: 400, headers: privateHeaders });
    }
    const body = parsed.value as Record<string, unknown>;
    const profileId = readProfileId(body.profileId);
    if (!profileId) {
      return Response.json({ code: "INVALID_PROFILE" }, { status: 400, headers: privateHeaders });
    }

    const examples = readExamples(body.examples);
    if (!examples.length) {
      await del(pathnameFor(profileId));
      return Response.json({ examples: [], deleted: true }, { headers: privateHeaders });
    }
    await put(
      pathnameFor(profileId),
      JSON.stringify({ examples, updatedAt: new Date().toISOString() }),
      {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      },
    );
    return Response.json({ examples, storage: "private-blob" }, { headers: privateHeaders });
  } catch (error) {
    console.error("Persona feedback write failed", error);
    return unavailable();
  }
}

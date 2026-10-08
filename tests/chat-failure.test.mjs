import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../app/chat-failure.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { classifyGeminiError, chatFailureMessage, isChatFailureCode } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("classifies a retried Gemini 503 as model congestion", () => {
  const error = { errors: [{ statusCode: 503 }, { statusCode: 503 }] };
  assert.equal(classifyGeminiError(error), "MODEL_BUSY");
  assert.match(chatFailureMessage("MODEL_BUSY"), /요청이 몰려/);
});

test("keeps client-facing error codes bounded", () => {
  assert.equal(classifyGeminiError({ statusCode: 429 }), "RATE_LIMITED");
  assert.equal(classifyGeminiError({ statusCode: 401 }), "AI_AUTH_FAILED");
  assert.equal(
    classifyGeminiError({ statusCode: 400, responseBody: '{"reason":"API_KEY_INVALID"}' }),
    "AI_AUTH_FAILED",
  );
  assert.equal(classifyGeminiError({ statusCode: 404 }), "MODEL_NOT_FOUND");
  assert.equal(classifyGeminiError({ statusCode: 500 }), "AI_UNAVAILABLE");
  assert.equal(isChatFailureCode("MODEL_BUSY"), true);
  assert.equal(isChatFailureCode("unexpected-internal-value"), false);
});

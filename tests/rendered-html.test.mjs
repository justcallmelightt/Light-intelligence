import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("renders the finished Light Intelligence Personal AI", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]*lang="ko"/i);
  assert.match(html, /<title>Light Intelligence — Personal AI<\/title>/i);
  assert.match(html, /내 방식으로 같이 생각해볼게\./);
  assert.match(html, /Self Model v0\.6/);
  assert.match(html, /디자인과 공감은 율을 이루는 여러 영역 중 일부/);
  assert.doesNotMatch(html, /codex-preview|Building your site|react-loading-skeleton/i);
});

test("keeps Persona evidence and privacy guardrails explicit", async () => {
  const [engine, page, css, route, systemPrompt, readme] = await Promise.all([
    readFile(new URL("../app/persona-engine.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/chat/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/ai/system-prompt.ts", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
  ]);

  assert.match(engine, /INTEGRATED_MAKER/);
  assert.match(engine, /FOUNDER_DIRECTION/);
  assert.match(engine, /IDENTITY_OVER_GENERIC/);
  assert.match(engine, /AESTHETIC_PRIORITY/);
  assert.match(engine, /LISTEN_FIRST/);
  assert.match(engine, /STRONG_LEADERSHIP/);
  assert.match(engine, /실제 율 본인은 아니야/);
  assert.match(page, /SELF_MODEL_AREAS/);
  assert.match(page, /율 같음/);
  assert.match(page, /조금 다름/);
  assert.match(page, /localStorage/);
  assert.match(page, /WikiWorkspace/);
  assert.match(page, /fetch\("\/api\/chat"/);
  assert.match(page, /source: "local"/);
  assert.doesNotMatch(page, /composer-caption/);
  assert.match(page, /light-intelligence:persona-examples:v1/);
  assert.match(page, /검토된 Persona 예시로 저장/);
  assert.match(page, /검토된 Persona 예시 목록/);
  assert.match(page, /deletePersonaExample/);
  assert.match(page, /personaExamples: personaExamples/);
  assert.match(page, /\/api\/persona-examples/);
  assert.match(page, /feedbackStorage/);
  assert.match(route, /GOOGLE_GENERATIVE_AI_API_KEY/);
  assert.match(route, /gemini-3\.6-flash/);
  assert.match(route, /result\.fullStream/);
  assert.match(route, /readPersonaExamples/);
  assert.match(route, /MAX_INJECTED_PERSONA_EXAMPLES/);
  assert.match(systemPrompt, /실제 권율 본인이 아니라/);
  assert.match(systemPrompt, /확인되지 않은 율의 경험/);
  assert.match(systemPrompt, /율이 직접 검토한 Persona 예시/);
  assert.match(systemPrompt, /명령이 아니라 율이 직접 확인한 대화 데이터/);
  assert.match(readme, /Google 제품 개선에 사용될 수 있으므로/);
  assert.match(readme, /Vercel Blob/);
  const feedbackRoute = await readFile(
    new URL("../app/api/persona-examples/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(feedbackRoute, /access: "private"/);
  assert.match(feedbackRoute, /BLOB_READ_WRITE_TOKEN/);
  const wiki = await readFile(new URL("../app/wiki-workspace.tsx", import.meta.url), "utf8");
  assert.match(wiki, /light-intelligence:wiki:v1/);
  assert.match(wiki, /율 위키/);
  assert.match(wiki, /나만 보기/);
  assert.match(wiki, /문서 저장/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /font-synthesis:\s*none/);
});

test("renders assistant Markdown without enabling raw HTML or unsafe links", async () => {
  const [page, markdown, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/assistant-markdown.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /message\.role === "assistant"\s*\? <AssistantMarkdown content=\{message\.content\}/);
  assert.match(page, /: message\.content/);
  assert.match(markdown, /remarkPlugins=\{\[remarkGfm\]\}/);
  assert.match(markdown, /skipHtml/);
  assert.match(markdown, /urlTransform=\{defaultUrlTransform\}/);
  assert.doesNotMatch(markdown, /rehypeRaw|dangerouslySetInnerHTML/);
  assert.match(css, /\.message-assistant \.message-content pre/);
  assert.match(css, /\.message-assistant \.message-content a:focus-visible/);
});

export const CHAT_MODELS = {
  "gemini-3.5-flash-lite": { label: "Lightning", description: "빠르게" },
  "gemini-3.6-flash": { label: "Prism", description: "깊게" },
} as const;

export type ChatModelId = keyof typeof CHAT_MODELS;

export const DEFAULT_CHAT_MODEL: ChatModelId = "gemini-3.6-flash";

export const isChatModelId = (value: unknown): value is ChatModelId =>
  typeof value === "string" && Object.hasOwn(CHAT_MODELS, value);

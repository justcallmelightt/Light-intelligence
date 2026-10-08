export type ChatFailureCode =
  | "MODEL_BUSY"
  | "RATE_LIMITED"
  | "AI_NOT_CONFIGURED"
  | "AI_AUTH_FAILED"
  | "MODEL_NOT_FOUND"
  | "NETWORK_ERROR"
  | "AI_UNAVAILABLE";

export const chatFailureMessage = (code: ChatFailureCode) => {
  switch (code) {
    case "MODEL_BUSY":
      return "Gemini 요청이 몰려 답을 받지 못했어. 잠시 후 다시 시도해줘.";
    case "RATE_LIMITED":
      return "요청 제한에 걸렸어. 잠시 기다린 뒤 다시 시도해줘.";
    case "AI_NOT_CONFIGURED":
      return "Gemini 연결 설정이 없어. 관리자 확인이 필요해.";
    case "AI_AUTH_FAILED":
      return "Gemini 인증에 실패했어. 관리자 확인이 필요해.";
    case "MODEL_NOT_FOUND":
      return "현재 설정된 Gemini 모델을 사용할 수 없어. 관리자 확인이 필요해.";
    case "NETWORK_ERROR":
      return "연결이 끊겨 Gemini 응답을 받지 못했어.";
    default:
      return "Gemini 응답을 완료하지 못했어. 잠시 후 다시 시도해줘.";
  }
};

export const isChatFailureCode = (value: unknown): value is ChatFailureCode =>
  value === "MODEL_BUSY" ||
  value === "RATE_LIMITED" ||
  value === "AI_NOT_CONFIGURED" ||
  value === "AI_AUTH_FAILED" ||
  value === "MODEL_NOT_FOUND" ||
  value === "NETWORK_ERROR" ||
  value === "AI_UNAVAILABLE";

export const classifyGeminiError = (error: unknown): ChatFailureCode => {
  const candidate = error as {
    statusCode?: unknown;
    cause?: unknown;
    errors?: unknown;
    responseBody?: unknown;
  } | null;
  if (!candidate || typeof candidate !== "object") return "AI_UNAVAILABLE";
  if (Array.isArray(candidate.errors) && candidate.errors.length > 0) {
    return classifyGeminiError(candidate.errors.at(-1));
  }
  if (typeof candidate.statusCode === "number") {
    if (
      candidate.statusCode === 400 &&
      typeof candidate.responseBody === "string" &&
      candidate.responseBody.includes("API_KEY_INVALID")
    ) return "AI_AUTH_FAILED";
    if (candidate.statusCode === 503) return "MODEL_BUSY";
    if (candidate.statusCode === 429) return "RATE_LIMITED";
    if (candidate.statusCode === 401 || candidate.statusCode === 403) return "AI_AUTH_FAILED";
    if (candidate.statusCode === 404) return "MODEL_NOT_FOUND";
  }
  if (candidate.cause && candidate.cause !== error) {
    return classifyGeminiError(candidate.cause);
  }
  return "AI_UNAVAILABLE";
};

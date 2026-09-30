"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  Info,
  Menu,
  MessageCircleMore,
  Moon,
  PanelRightOpen,
  Plus,
  RotateCcw,
  Settings2,
  Square,
  Sun,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import WikiWorkspace from "./wiki-workspace";
import { LightframeThinkingOrb } from "./lightframe-thinking-orb";
import {
  MAX_PERSONA_EXAMPLES,
  type PersonaExample,
} from "./ai/persona-examples";
import {
  getPersonaResponse,
  TRAIT_CATALOG,
  type PersonaSettings,
  type PersonaTrace,
} from "./persona-engine";

type FeedbackValue = "same" | "different";
type ThinkingPhase = "persona" | "thinking" | null;

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  source?: "gemini" | "local";
  trace?: PersonaTrace;
  feedback?: FeedbackValue;
};

type FeedbackDraft = {
  messageId: string;
  prompt: string;
  aiResponse: string;
  reasons: string[];
  correctedResponse: string;
  note: string;
};

const DEFAULT_SETTINGS: PersonaSettings = {
  honesty: 85,
  talkativeness: 75,
  empathy: 80,
  designPriority: 90,
};

const DEMO_PROMPTS = [
  {
    label: "나는 어떤 사람인 것 같아?",
    prompt: "지금까지 확인된 내용을 바탕으로 나는 어떤 사람인지 설명해줘.",
  },
  {
    label: "내 목표 기준으로 정해줘",
    prompt: "개발 공부와 새 프로젝트 중 뭘 먼저 할지 내 장기 목표 기준으로 정해줘.",
  },
  {
    label: "나라면 어떤 걸 고를까?",
    prompt: "둘 중 하나를 골라야 하는데 나라면 어떤 기준으로 선택할까?",
  },
  {
    label: "프로젝트 위기를 맡겨볼게",
    prompt: "발표가 내일인데 Backend 담당이 API 연결을 포기했어.",
  },
  {
    label: "내 말투로 답장해줘",
    prompt: "친한 친구에게 보낼 답장을 내 말투로 같이 써줘.",
  },
  {
    label: "창업 아이디어를 판단해줘",
    prompt: "새로운 학교 앱 아이디어가 있는데 현실적으로 성공하기 어렵다는 말을 들었어.",
  },
];

const FEEDBACK_REASONS = [
  "말투가 다름",
  "판단이 다름",
  "너무 길거나 짧음",
  "가치관 반영이 다름",
  "기억이 다르거나 부족함",
];

const SELF_MODEL_AREAS = [
  ["정체성", "개발·디자인·기획·브랜드를 연결하는 Maker"],
  ["가치관", "착함, 고유함, 미적 완성도, 솔직한 판단"],
  ["목표", "디자인과 개발을 융합한 Founder"],
  ["행동", "먼저 만들고, 위기에서는 직접 해결"],
  ["관계", "가까운 사람의 이야기를 먼저 듣기"],
  ["표현", "친근한 대화체와 세심한 격식 전환"],
] as const;

const STORAGE_KEYS = {
  messages: "light-intelligence:messages",
  settings: "light-intelligence:settings",
  personaExamples: "light-intelligence:persona-examples:v1",
  personaProfileId: "light-intelligence:persona-profile-id:v1",
  theme: "light-intelligence:theme",
};

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const readStoredValue = <T,>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export default function Home() {
  const reduceMotion = useReducedMotion();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isResponding, setIsResponding] = useState(false);
  const [thinkingPhase, setThinkingPhase] = useState<ThinkingPhase>(null);
  const [hydrated, setHydrated] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [settings, setSettings] =
    useState<PersonaSettings>(DEFAULT_SETTINGS);
  const [openPanel, setOpenPanel] = useState<
    "menu" | "inspector" | "settings" | null
  >(null);
  const [expandedTrace, setExpandedTrace] = useState<string | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null,
  );
  const [feedbackDraft, setFeedbackDraft] =
    useState<FeedbackDraft | null>(null);
  const [personaExamples, setPersonaExamples] = useState<PersonaExample[]>([]);
  const [feedbackStorage, setFeedbackStorage] = useState<
    "checking" | "synced" | "offline"
  >("checking");
  const [hasUnseen, setHasUnseen] = useState(false);
  const [workspace, setWorkspace] = useState<"chat" | "wiki">("chat");

  const responseControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);

  useEffect(() => {
    const storedMessages = readStoredValue<ChatMessage[]>(
      STORAGE_KEYS.messages,
      [],
    );
    const storedSettings = readStoredValue<PersonaSettings>(
      STORAGE_KEYS.settings,
      DEFAULT_SETTINGS,
    );
    const storedTheme = window.localStorage.getItem(STORAGE_KEYS.theme);
    const storedExamples = readStoredValue<PersonaExample[]>(
      STORAGE_KEYS.personaExamples,
      [],
    );

    queueMicrotask(() => {
      setMessages(storedMessages);
      setSettings(storedSettings);
      setPersonaExamples(storedExamples.slice(-MAX_PERSONA_EXAMPLES));
      setTheme(storedTheme === "light" ? "light" : "dark");
      setHydrated(true);
    });

    const profileId =
      window.localStorage.getItem(STORAGE_KEYS.personaProfileId) ?? createId();
    window.localStorage.setItem(STORAGE_KEYS.personaProfileId, profileId);

    void fetch(`/api/persona-examples?profileId=${encodeURIComponent(profileId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Feedback store unavailable");
        return (await response.json()) as { examples: PersonaExample[] };
      })
      .then(async ({ examples }) => {
        if (examples.length) {
          const remoteExamples = examples.slice(-MAX_PERSONA_EXAMPLES);
          setPersonaExamples(remoteExamples);
          window.localStorage.setItem(
            STORAGE_KEYS.personaExamples,
            JSON.stringify(remoteExamples),
          );
        } else if (storedExamples.length) {
          const migration = await fetch("/api/persona-examples", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              profileId,
              examples: storedExamples.slice(-MAX_PERSONA_EXAMPLES),
            }),
          });
          if (!migration.ok) throw new Error("Feedback migration unavailable");
        }
        setFeedbackStorage("synced");
      })
      .catch(() => setFeedbackStorage("offline"));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEYS.messages, JSON.stringify(messages));
  }, [hydrated, messages]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  }, [hydrated, settings]);

  const savePersonaExamples = async (next: PersonaExample[]) => {
    const normalized = next.slice(-MAX_PERSONA_EXAMPLES);
    setPersonaExamples(normalized);
    window.localStorage.setItem(
      STORAGE_KEYS.personaExamples,
      JSON.stringify(normalized),
    );

    const profileId = window.localStorage.getItem(STORAGE_KEYS.personaProfileId);
    if (!profileId) {
      setFeedbackStorage("offline");
      return;
    }

    setFeedbackStorage("checking");
    try {
      const response = await fetch("/api/persona-examples", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, examples: normalized }),
      });
      if (!response.ok) throw new Error("Feedback sync unavailable");
      setFeedbackStorage("synced");
    } catch {
      setFeedbackStorage("offline");
    }
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (hydrated) window.localStorage.setItem(STORAGE_KEYS.theme, theme);
  }, [hydrated, theme]);

  useEffect(() => {
    if (!messages.length) return;
    if (shouldAutoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "end",
      });
      requestAnimationFrame(() => setHasUnseen(false));
    } else if (messages.at(-1)?.role === "assistant") {
      requestAnimationFrame(() => setHasUnseen(true));
    }
  }, [messages, reduceMotion]);

  useEffect(
    () => () => {
      responseControllerRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
  }, [input]);

  const latestAssistant = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant"),
    [messages],
  );

  const selectedAssistant = useMemo(
    () =>
      messages.find(
        (message) =>
          message.id === selectedMessageId && message.role === "assistant",
      ) ?? latestAssistant,
    [latestAssistant, messages, selectedMessageId],
  );

  const motionTransition = reduceMotion
    ? { duration: 0.15 }
    : { type: "spring" as const, stiffness: 420, damping: 41, mass: 1 };
  const waitingForFirstToken =
    isResponding &&
    (messages.at(-1)?.role !== "assistant" || !messages.at(-1)?.content);

  const submitMessage = async (rawValue?: string) => {
    const content = (rawValue ?? input).trim();
    if (!content || isResponding) return;

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content,
    };

    const conversation = [...messages, userMessage].slice(-16);
    setMessages(conversation);
    setInput("");
    setIsResponding(true);
    setThinkingPhase("persona");
    shouldAutoScrollRef.current = true;

    const localResult = getPersonaResponse(content, settings);
    const assistantId = createId();
    const controller = new AbortController();
    responseControllerRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversation.map(({ role, content: messageContent }) => ({
            role,
            content: messageContent,
          })),
          settings,
          personaExamples: personaExamples.slice(-MAX_PERSONA_EXAMPLES),
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) throw new Error("Gemini unavailable");
      setThinkingPhase("thinking");

      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        source: "gemini",
        trace: localResult.trace,
      };
      setMessages((current) => [...current, assistantMessage]);
      setSelectedMessageId(assistantId);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk) setThinkingPhase(null);
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? { ...message, content: `${message.content}${chunk}` }
              : message,
          ),
        );
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: localResult.content,
        source: "local",
        trace: localResult.trace,
      };
      setMessages((current) => {
        const withoutPartial = current.filter((message) => message.id !== assistantId);
        return [...withoutPartial, assistantMessage];
      });
      setSelectedMessageId(assistantId);
      console.info("Gemini is unavailable; using the local persona engine.", error);
    } finally {
      if (responseControllerRef.current === controller) {
        responseControllerRef.current = null;
        setIsResponding(false);
        setThinkingPhase(null);
      }
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitMessage();
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitMessage();
    }
  };

  const stopResponse = () => {
    responseControllerRef.current?.abort();
    responseControllerRef.current = null;
    setIsResponding(false);
    setThinkingPhase(null);
  };

  const startNewChat = () => {
    stopResponse();
    setMessages([]);
    setSelectedMessageId(null);
    setExpandedTrace(null);
    setHasUnseen(false);
    setOpenPanel(null);
    setWorkspace("chat");
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const recordSameFeedback = (messageId: string) => {
    const messageIndex = messages.findIndex((message) => message.id === messageId);
    const assistantMessage = messages[messageIndex];
    const userMessage = [...messages.slice(0, messageIndex)]
      .reverse()
      .find((message) => message.role === "user");
    if (!assistantMessage || !userMessage) return;

    const example: PersonaExample = {
      id: createId(),
      messageId,
      kind: "same",
      prompt: userMessage.content,
      response: assistantMessage.content,
      reasons: [],
      note: "",
      approved: true,
      createdAt: new Date().toISOString(),
    };
    const next = [
      ...personaExamples.filter((item) => item.messageId !== messageId),
      example,
    ].slice(-MAX_PERSONA_EXAMPLES);
    void savePersonaExamples(next);
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? { ...message, feedback: "same" as const }
          : message,
      ),
    );
  };

  const saveDifferentFeedback = () => {
    if (!feedbackDraft) return;
    const correctedResponse = feedbackDraft.correctedResponse.trim();
    if (!correctedResponse) return;
    const example: PersonaExample = {
      id: createId(),
      messageId: feedbackDraft.messageId,
      kind: "correction",
      prompt: feedbackDraft.prompt,
      response: correctedResponse,
      reasons: feedbackDraft.reasons,
      note: feedbackDraft.note.trim(),
      approved: true,
      createdAt: new Date().toISOString(),
    };
    const next = [
      ...personaExamples.filter(
        (item) => item.messageId !== feedbackDraft.messageId,
      ),
      example,
    ].slice(-MAX_PERSONA_EXAMPLES);
    void savePersonaExamples(next);
    setMessages((current) =>
      current.map((message) =>
        message.id === feedbackDraft.messageId
          ? { ...message, feedback: "different" as const }
          : message,
      ),
    );
    setFeedbackDraft(null);
  };

  const deletePersonaExample = (exampleId: string) => {
    const target = personaExamples.find((example) => example.id === exampleId);
    const next = personaExamples.filter((example) => example.id !== exampleId);
    void savePersonaExamples(next);
    if (target) {
      setMessages((current) =>
        current.map((message) =>
          message.id === target.messageId
            ? { ...message, feedback: undefined }
            : message,
        ),
      );
    }
  };

  const jumpToLatest = () => {
    shouldAutoScrollRef.current = true;
    messagesEndRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "end",
    });
    setHasUnseen(false);
  };

  const onScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    shouldAutoScrollRef.current = distance < 140;
    if (distance < 140) setHasUnseen(false);
  };

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="대화와 Self Model 영역">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            L
          </div>
          <div>
            <strong>Light Intelligence</strong>
            <span>Personal AI</span>
          </div>
        </div>

        <motion.button
          className="new-chat-button pressable"
          type="button"
          onClick={startNewChat}
          whileTap={{ scale: 0.98 }}
          transition={motionTransition}
        >
          <Plus size={17} strokeWidth={2.2} />
          새 대화
        </motion.button>

        <button
          className={`wiki-nav-button pressable ${workspace === "wiki" ? "is-active" : ""}`}
          type="button"
          onClick={() => setWorkspace("wiki")}
        >
          <BookOpen size={17} />
          율 위키
        </button>

        <nav className="demo-nav" aria-label="Self Model 영역">
          <p className="eyebrow">나의 여러 모습</p>
          {DEMO_PROMPTS.map((item) => (
            <button
              className="demo-nav-item pressable"
              type="button"
              key={item.label}
              onClick={() => submitMessage(item.prompt)}
              disabled={isResponding}
            >
              <MessageCircleMore size={16} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button
            className="persona-version pressable"
            type="button"
            onClick={() => setOpenPanel("inspector")}
          >
            <span className="status-dot" aria-hidden="true" />
            <span>
              <strong>Self Model v0.6</strong>
              <small>{personaExamples.length}개의 검토된 예시</small>
            </span>
            <ChevronDown size={15} aria-hidden="true" />
          </button>
        </div>
      </aside>

      {workspace === "wiki" ? (
        <WikiWorkspace />
      ) : (
      <section className="chat-column" aria-label="Light Intelligence 대화">
        <header className="topbar">
          <button
            type="button"
            className="icon-button mobile-only pressable"
            aria-label="메뉴 열기"
            onClick={() => setOpenPanel("menu")}
          >
            <Menu size={20} />
          </button>
          <div className="topbar-title">
            <strong>Light Intelligence</strong>
            <span>
              <i aria-hidden="true" /> Self Model v0.6
            </span>
          </div>
          <div className="topbar-actions">
            <button
              type="button"
              className="icon-button pressable"
              aria-label={theme === "dark" ? "라이트 모드" : "다크 모드"}
              onClick={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
            >
              {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button
              type="button"
              className="icon-button pressable"
              aria-label="Persona 설정 열기"
              onClick={() => setOpenPanel("settings")}
            >
              <Settings2 size={19} />
            </button>
            <button
              type="button"
              className="icon-button mobile-only pressable"
              aria-label="적용된 기준 보기"
              onClick={() => setOpenPanel("inspector")}
            >
              <PanelRightOpen size={19} />
            </button>
          </div>
        </header>

        <div className="message-scroll" ref={scrollRef} onScroll={onScroll}>
          <div className="message-width">
            {messages.length === 0 ? (
              <motion.section
                className="empty-state"
                initial={{ opacity: 0, scale: 0.985, filter: "blur(6px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                transition={motionTransition}
              >
                <div className="hero-mark" aria-hidden="true">
                  L
                </div>
                <p className="eyebrow">LIGHT INTELLIGENCE · PERSONAL AI</p>
                <h1>내 방식으로 같이 생각해볼게.</h1>
                <p className="hero-description">
                  말투만 흉내 내는 챗봇이 아니라, 율의 기억·취향·가치관·목표와
                  판단 기준을 하나의 Self Model로 연결하는 초기 버전이야.
                </p>
                <div className="suggestion-list" aria-label="추천 질문">
                  {DEMO_PROMPTS.slice(0, 3).map((item) => (
                    <motion.button
                      className="suggestion-pill pressable"
                      type="button"
                      key={item.label}
                      onClick={() => submitMessage(item.prompt)}
                      whileTap={{ scale: 0.98 }}
                      transition={motionTransition}
                    >
                      {item.label}
                      <ArrowUp size={15} aria-hidden="true" />
                    </motion.button>
                  ))}
                </div>
                <div className="persona-notice">
                  <Info size={15} aria-hidden="true" />
                  디자인과 공감은 율을 이루는 여러 영역 중 일부야.
                </div>
              </motion.section>
            ) : (
              <div className="message-list" aria-busy={isResponding}>
                <AnimatePresence initial={false}>
                  {messages.filter((message) => !(
                    isResponding && message.role === "assistant" && !message.content
                  )).map((message) => (
                    <motion.article
                      className={`message message-${message.role}`}
                      key={message.id}
                      initial={{ opacity: 0, y: 8, scale: 0.985, filter: "blur(6px)" }}
                      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                      exit={{ opacity: 0 }}
                      transition={motionTransition}
                      onClick={() =>
                        message.role === "assistant" && setSelectedMessageId(message.id)
                      }
                    >
                      {message.role === "assistant" && (
                        <div className="assistant-label">
                          <span className="mini-mark" aria-hidden="true">
                            L
                          </span>
                          <strong>Light Intelligence</strong>
                          <span>
                            {message.source === "gemini"
                              ? "Gemini · AI 응답"
                              : "Local fallback"}
                          </span>
                        </div>
                      )}
                      <div className="message-content">{message.content}</div>

                      {message.role === "assistant" && message.trace && (
                        <div className="message-tools">
                          <button
                            className="trace-toggle pressable"
                            type="button"
                            aria-expanded={expandedTrace === message.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              setExpandedTrace((value) =>
                                value === message.id ? null : message.id,
                              );
                            }}
                          >
                            이 답변에 반영된 나 · {message.trace.traits.length}
                            <ChevronDown
                              size={15}
                              className={
                                expandedTrace === message.id ? "is-rotated" : ""
                              }
                            />
                          </button>

                          <AnimatePresence initial={false}>
                            {expandedTrace === message.id && (
                              <motion.div
                                className="inline-trace"
                                initial={{ opacity: 0, height: 0, scale: 0.985 }}
                                animate={{ opacity: 1, height: "auto", scale: 1 }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={motionTransition}
                              >
                                {message.trace.traits.map((trait) => (
                                  <div className="inline-trait" key={trait}>
                                    <Check size={14} aria-hidden="true" />
                                    <span>{TRAIT_CATALOG[trait].title}</span>
                                  </div>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <div className="feedback-row" aria-label="답변 평가">
                            {message.feedback ? (
                              <span className="feedback-saved">
                                <Check size={14} aria-hidden="true" />
                                {message.feedback === "same"
                                  ? "율 같다고 기록했어"
                                  : "교정 의견을 저장했어"}
                              </span>
                            ) : (
                              <>
                                <button
                                  className="feedback-button pressable"
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    recordSameFeedback(message.id);
                                  }}
                                >
                                  <ThumbsUp size={15} /> 율 같음
                                </button>
                                <button
                                  className="feedback-button pressable"
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setFeedbackDraft({
                                      messageId: message.id,
                                      prompt:
                                        [...messages.slice(0, messages.indexOf(message))]
                                          .reverse()
                                          .find((item) => item.role === "user")
                                          ?.content ?? "",
                                      aiResponse: message.content,
                                      reasons: [],
                                      correctedResponse: "",
                                      note: "",
                                    });
                                  }}
                                >
                                  조금 다름
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </motion.article>
                  ))}
                </AnimatePresence>

                {waitingForFirstToken && thinkingPhase && (
                  <motion.div
                    className="matching-state"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={motionTransition}
                    role="status"
                    aria-live="polite"
                  >
                    <LightframeThinkingOrb />
                    <span className="matching-state-text">
                      {thinkingPhase === "persona" ? "율을 불러오는 중" : "생각 중"}
                    </span>
                  </motion.div>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <AnimatePresence>
          {hasUnseen && (
            <motion.button
              className="new-answer-button pressable"
              type="button"
              onClick={jumpToLatest}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              transition={motionTransition}
            >
              <ArrowDown size={15} /> 새 답변 보기
            </motion.button>
          )}
        </AnimatePresence>

        <div className="composer-zone">
          <form className="composer" onSubmit={handleSubmit}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="율에게 물어보기"
              aria-label="Light Intelligence에게 보낼 메시지"
              rows={1}
              disabled={isResponding}
            />
            <motion.button
              className="send-button pressable"
              type={isResponding ? "button" : "submit"}
              aria-label={isResponding ? "응답 중지" : "메시지 보내기"}
              disabled={!isResponding && !input.trim()}
              onClick={isResponding ? stopResponse : undefined}
              whileTap={{ scale: 0.9 }}
              transition={motionTransition}
            >
              {isResponding ? (
                <Square size={15} fill="currentColor" />
              ) : (
                <ArrowUp size={19} />
              )}
            </motion.button>
          </form>
        </div>
      </section>
      )}

      <aside className={`inspector desktop-inspector ${workspace === "wiki" ? "wiki-side-info" : ""}`} aria-label={workspace === "wiki" ? "위키 저장 안내" : "적용된 Self Model"}>
        {workspace === "wiki" ? (
          <div className="inspector-content">
            <div className="panel-heading">
              <p className="eyebrow">PRIVATE BY DEFAULT</p>
              <h2>나를 아는 기준점</h2>
              <p>추측이 아니라 율이 직접 확인한 문서를 기준으로 쌓는 개인 지식 공간이야.</p>
            </div>
            <div className="learning-card wiki-local-card">
              <div><span>저장 위치</span><strong>Local</strong></div>
              <p>현재 문서는 이 브라우저에만 저장돼. 다른 기기나 외부 AI에는 자동으로 공유되지 않아.</p>
            </div>
          </div>
        ) : (
        <InspectorContent
          message={selectedAssistant}
          feedbackCount={personaExamples.length}
          feedbackStorage={feedbackStorage}
          examples={personaExamples}
          onDeleteExample={deletePersonaExample}
        />
        )}
      </aside>

      <AnimatePresence>
        {openPanel && (
          <PanelOverlay
            panel={openPanel}
            onClose={() => setOpenPanel(null)}
            transition={motionTransition}
          >
            {openPanel === "menu" && (
              <MobileMenu
                isResponding={isResponding}
                onPrompt={(prompt) => {
                  setOpenPanel(null);
                  submitMessage(prompt);
                }}
                onNewChat={startNewChat}
                onOpenWiki={() => {
                  setOpenPanel(null);
                  setWorkspace("wiki");
                }}
              />
            )}
            {openPanel === "inspector" && (
              <InspectorContent
                message={selectedAssistant}
                feedbackCount={personaExamples.length}
                feedbackStorage={feedbackStorage}
                examples={personaExamples}
                onDeleteExample={deletePersonaExample}
              />
            )}
            {openPanel === "settings" && (
              <SettingsContent settings={settings} onChange={setSettings} />
            )}
          </PanelOverlay>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {feedbackDraft && (
          <FeedbackOverlay
            draft={feedbackDraft}
            onChange={setFeedbackDraft}
            onClose={() => setFeedbackDraft(null)}
            onSave={saveDifferentFeedback}
            transition={motionTransition}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

function InspectorContent({
  message,
  feedbackCount,
  feedbackStorage,
  examples,
  onDeleteExample,
}: {
  message?: ChatMessage;
  feedbackCount: number;
  feedbackStorage: "checking" | "synced" | "offline";
  examples: PersonaExample[];
  onDeleteExample: (exampleId: string) => void;
}) {
  return (
    <div className="inspector-content">
      <div className="panel-heading">
        <p className="eyebrow">SELF MODEL INSPECTOR</p>
        <h2>이 답변에 반영된 나</h2>
        <p>생각 과정을 공개하는 대신, 연결된 영역과 확인된 율의 특징을 보여줘.</p>
      </div>

      {message?.trace ? (
        <>
          <div className="trace-summary">
            <span className="trace-domain">{message.trace.domainLabel}</span>
            <span className="trace-intent">{message.trace.intentLabel}</span>
            <span>{message.trace.evidenceLabel}</span>
          </div>
          <div className="trait-stack">
            {message.trace.traits.map((trait) => (
              <article className="trait-card" key={trait}>
                <div className="trait-check" aria-hidden="true">
                  <Check size={14} />
                </div>
                <div>
                  <h3>{TRAIT_CATALOG[trait].title}</h3>
                  <p>{TRAIT_CATALOG[trait].description}</p>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="inspector-empty">
          <div className="self-model-map">
            {SELF_MODEL_AREAS.map(([name, description]) => (
              <div className="self-model-area" key={name}>
                <strong>{name}</strong>
                <span>{description}</span>
              </div>
            ))}
          </div>
          <p>질문에 따라 필요한 영역만 연결해 답해. 아직 확인되지 않은 모습은 빈칸으로 남겨둬.</p>
        </div>
      )}

      <div className="learning-card">
        <div>
          <span>검토된 Persona 예시</span>
          <strong>{feedbackCount}</strong>
        </div>
        <p>
          {feedbackStorage === "synced"
            ? "비공개 서버 저장소에 동기화됐고, 다음 Gemini 요청에는 필요한 예시만 포함돼."
            : feedbackStorage === "checking"
              ? "피드백 저장 상태를 확인하는 중이야."
              : "서버 저장소가 아직 연결되지 않아 이 브라우저에 임시 보관 중이야."} Foundation
          Model 자체를 학습했다고 표현하지 않아.
        </p>
        <p className="feedback-guide">
          답변을 받은 뒤 그 아래의 <strong>율 같음</strong> 또는 <strong>조금 다름</strong>을 눌러 기록해.
        </p>
      </div>
      {examples.length > 0 && (
        <div className="example-stack" aria-label="검토된 Persona 예시 목록">
          {[...examples].reverse().slice(0, 5).map((example) => (
            <article className="example-card" key={example.id}>
              <div className="example-card-head">
                <span>
                  {example.kind === "correction" ? "직접 교정" : "율 같음"}
                </span>
                <button
                  className="example-delete pressable"
                  type="button"
                  onClick={() => onDeleteExample(example.id)}
                  aria-label="이 Persona 예시 삭제"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <p>{example.prompt}</p>
              <strong>{example.response}</strong>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsContent({
  settings,
  onChange,
}: {
  settings: PersonaSettings;
  onChange: (next: PersonaSettings) => void;
}) {
  const controls: Array<{
    key: keyof PersonaSettings;
    label: string;
    description: string;
  }> = [
    { key: "honesty", label: "솔직함", description: "결론을 얼마나 분명하게 말할지" },
    {
      key: "talkativeness",
      label: "말 많음",
      description: "설명과 대화의 밀도를 조절해",
    },
    { key: "empathy", label: "감정 공감", description: "해결보다 듣기를 얼마나 앞세울지" },
    {
      key: "designPriority",
      label: "디자인 우선",
      description: "기능과 미감이 충돌할 때의 무게야",
    },
  ];

  return (
    <div className="settings-content">
      <div className="panel-heading">
        <p className="eyebrow">RESPONSE TUNING</p>
        <h2>표현 강도</h2>
        <p>말하는 방식만 조절해. 율의 기억·가치관·정체성을 바꾸지는 않아.</p>
      </div>
      <div className="slider-stack">
        {controls.map((control) => (
          <label className="slider-row" key={control.key}>
            <span>
              <strong>{control.label}</strong>
              <small>{control.description}</small>
            </span>
            <output>{settings[control.key]}</output>
            <input
              type="range"
              min="20"
              max="100"
              value={settings[control.key]}
              onChange={(event) =>
                onChange({
                  ...settings,
                  [control.key]: Number(event.target.value),
                })
              }
            />
          </label>
        ))}
      </div>
      <button
        type="button"
        className="reset-settings pressable"
        onClick={() => onChange(DEFAULT_SETTINGS)}
      >
        <RotateCcw size={16} /> 기본값으로 되돌리기
      </button>
    </div>
  );
}

function MobileMenu({
  onPrompt,
  onNewChat,
  isResponding,
  onOpenWiki,
}: {
  onPrompt: (prompt: string) => void;
  onNewChat: () => void;
  isResponding: boolean;
  onOpenWiki: () => void;
}) {
  return (
    <div className="mobile-menu-content">
      <div className="panel-heading">
        <p className="eyebrow">Light Intelligence</p>
        <h2>Personal AI</h2>
        <p>기억·취향·가치관·목표와 말투를 연결하는 율 기반 Self Model이야.</p>
      </div>
      <button className="new-chat-button pressable" type="button" onClick={onNewChat}>
        <Plus size={17} /> 새 대화
      </button>
      <button className="wiki-nav-button mobile-wiki-button pressable" type="button" onClick={onOpenWiki}>
        <BookOpen size={17} /> 율 위키 열기
      </button>
      <div className="mobile-prompt-list">
        <p className="eyebrow">나의 여러 모습</p>
        {DEMO_PROMPTS.map((item) => (
          <button
            type="button"
            className="mobile-prompt pressable"
            key={item.label}
            onClick={() => onPrompt(item.prompt)}
            disabled={isResponding}
          >
            <span>{item.label}</span>
            <ArrowUp size={15} />
          </button>
        ))}
      </div>
    </div>
  );
}

function PanelOverlay({
  children,
  panel,
  onClose,
  transition,
}: {
  children: React.ReactNode;
  panel: string;
  onClose: () => void;
  transition: { duration: number } | { type: "spring"; stiffness: number; damping: number; mass: number };
}) {
  return (
    <motion.div
      className="overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <motion.section
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={panel === "settings" ? "Persona 설정" : "Persona 정보"}
        initial={{ opacity: 0, y: 28, scale: 0.97, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: 18, scale: 0.98 }}
        transition={transition}
      >
        <div className="sheet-reflection" aria-hidden="true" />
        <button
          className="sheet-close icon-button pressable"
          type="button"
          onClick={onClose}
          aria-label="닫기"
        >
          <X size={19} />
        </button>
        {children}
      </motion.section>
    </motion.div>
  );
}

function FeedbackOverlay({
  draft,
  onChange,
  onClose,
  onSave,
  transition,
}: {
  draft: FeedbackDraft;
  onChange: (next: FeedbackDraft) => void;
  onClose: () => void;
  onSave: () => void;
  transition: { duration: number } | { type: "spring"; stiffness: number; damping: number; mass: number };
}) {
  const toggleReason = (reason: string) => {
    onChange({
      ...draft,
      reasons: draft.reasons.includes(reason)
        ? draft.reasons.filter((item) => item !== reason)
        : [...draft.reasons, reason],
    });
  };

  return (
    <motion.div
      className="overlay feedback-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <motion.section
        className="feedback-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Light Intelligence 답변 교정"
        initial={{ opacity: 0, y: 26, scale: 0.97, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: 14, scale: 0.98 }}
        transition={transition}
      >
        <button
          className="sheet-close icon-button pressable"
          type="button"
          onClick={onClose}
          aria-label="닫기"
        >
          <X size={19} />
        </button>
        <div className="panel-heading">
          <p className="eyebrow">PERSONA FEEDBACK</p>
          <h2>율이라면 어떻게 답해?</h2>
          <p>율이 직접 확정한 답변만 검토된 예시로 저장하고, 다음 대화부터 반영할게.</p>
        </div>
        <div className="feedback-context" aria-label="교정할 대화">
          <div>
            <span>질문</span>
            <p>{draft.prompt}</p>
          </div>
          <div>
            <span>AI가 답한 방식</span>
            <p>{draft.aiResponse}</p>
          </div>
        </div>
        <div className="reason-grid">
          {FEEDBACK_REASONS.map((reason) => {
            const selected = draft.reasons.includes(reason);
            return (
              <button
                type="button"
                className={`reason-chip pressable ${selected ? "is-selected" : ""}`}
                key={reason}
                onClick={() => toggleReason(reason)}
                aria-pressed={selected}
              >
                {selected && <Check size={14} />}
                {reason}
              </button>
            );
          })}
        </div>
        <label className="feedback-note">
          <span>실제 율의 답변 <b>필수</b></span>
          <textarea
            value={draft.correctedResponse}
            onChange={(event) =>
              onChange({ ...draft, correctedResponse: event.target.value })
            }
            placeholder="예: 왜왜 무슨 일 있었는데?"
            rows={4}
            maxLength={2000}
            autoFocus
          />
        </label>
        <label className="feedback-note feedback-note-secondary">
          <span>이유나 기준 <small>선택</small></span>
          <textarea
            value={draft.note}
            onChange={(event) => onChange({ ...draft, note: event.target.value })}
            placeholder="예: 힘든 상황에서는 해결보다 먼저 이유를 물어봐"
            rows={2}
            maxLength={500}
          />
        </label>
        <button
          type="button"
          className="save-feedback pressable"
          onClick={onSave}
          disabled={!draft.correctedResponse.trim()}
        >
          검토된 Persona 예시로 저장
        </button>
      </motion.section>
    </motion.div>
  );
}

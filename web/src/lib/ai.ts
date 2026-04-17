export type Provider = "gemini" | "openai" | "groq" | "anthropic";

const CONFIG_STORAGE = "forgmind.ai.config.v2";
const LEGACY_KEY = "forgmind.ai.key.v1";

interface AIConfig {
  active: Provider;
  keys: Partial<Record<Provider, string>>;
}

interface ProviderMeta {
  name: string;
  model: string;
  placeholder: string;
  keyUrl: string;
  keyUrlLabel: string;
  free: boolean;
  note: string;
}

export const PROVIDER_INFO: Record<Provider, ProviderMeta> = {
  gemini: {
    name: "Google Gemini",
    model: "gemini-2.0-flash",
    placeholder: "AIza...",
    keyUrl: "https://aistudio.google.com/apikey",
    keyUrlLabel: "aistudio.google.com/apikey",
    free: true,
    note: "Generous free tier, no credit card.",
  },
  openai: {
    name: "OpenAI",
    model: "gpt-4o-mini",
    placeholder: "sk-...",
    keyUrl: "https://platform.openai.com/api-keys",
    keyUrlLabel: "platform.openai.com/api-keys",
    free: false,
    note: "Paid. Requires billing setup. GPT-4o-mini is cheap.",
  },
  groq: {
    name: "Groq",
    model: "llama-3.3-70b-versatile",
    placeholder: "gsk_...",
    keyUrl: "https://console.groq.com/keys",
    keyUrlLabel: "console.groq.com/keys",
    free: true,
    note: "Free tier, very fast inference. Runs Llama 3.3.",
  },
  anthropic: {
    name: "Anthropic Claude",
    model: "claude-haiku-4-5",
    placeholder: "sk-ant-...",
    keyUrl: "https://console.anthropic.com/settings/keys",
    keyUrlLabel: "console.anthropic.com",
    free: false,
    note: "Paid. ~$1 per 1000 short requests with Haiku.",
  },
};

export const PROVIDERS: Provider[] = ["gemini", "openai", "groq", "anthropic"];

function loadConfig(): AIConfig {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE);
    if (raw) {
      const parsed = JSON.parse(raw) as AIConfig;
      if (parsed && parsed.active && parsed.keys) return parsed;
    }
  } catch {
    /* ignore */
  }
  const legacy = localStorage.getItem(LEGACY_KEY);
  if (legacy) {
    const migrated: AIConfig = { active: "gemini", keys: { gemini: legacy } };
    saveConfig(migrated);
    return migrated;
  }
  return { active: "gemini", keys: {} };
}

function saveConfig(cfg: AIConfig): void {
  localStorage.setItem(CONFIG_STORAGE, JSON.stringify(cfg));
}

export function getConfig(): AIConfig {
  return loadConfig();
}

export function getActiveProvider(): Provider {
  return loadConfig().active;
}

export function getProviderKey(p: Provider): string {
  return loadConfig().keys[p] || "";
}

export function setActiveAndKey(p: Provider, key: string): void {
  const cfg = loadConfig();
  cfg.active = p;
  const trimmed = key.trim();
  if (!trimmed) delete cfg.keys[p];
  else cfg.keys[p] = trimmed;
  saveConfig(cfg);
}

export function clearProviderKey(p: Provider): void {
  const cfg = loadConfig();
  delete cfg.keys[p];
  saveConfig(cfg);
}

export function hasActiveKey(): boolean {
  const cfg = loadConfig();
  return !!cfg.keys[cfg.active];
}

async function apiError(res: Response): Promise<Error> {
  let msg = `API error ${res.status}`;
  try {
    const err = await res.json();
    msg = err?.error?.message || err?.message || msg;
  } catch {
    /* ignore */
  }
  return new Error(msg);
}

async function callGemini(key: string, system: string, user: string): Promise<string> {
  const model = PROVIDER_INFO.gemini.model;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
    }),
  });
  if (!res.ok) throw await apiError(res);
  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) throw new Error("Gemini returned no text.");
  return text.trim();
}

async function callOpenAICompatible(
  url: string,
  key: string,
  model: string,
  system: string,
  user: string
): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });
  if (!res.ok) throw await apiError(res);
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("No response text.");
  return text.trim();
}

async function callAnthropic(key: string, system: string, user: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: PROVIDER_INFO.anthropic.model,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw await apiError(res);
  const data = await res.json();
  const block = (data.content || []).find((b: { type: string }) => b.type === "text");
  const text: string = block?.text ?? "";
  if (!text) throw new Error("Claude returned no text.");
  return text.trim();
}

async function call(system: string, user: string): Promise<string> {
  const cfg = loadConfig();
  const key = cfg.keys[cfg.active];
  if (!key) {
    throw new Error(
      `No API key set for ${PROVIDER_INFO[cfg.active].name}. Open AI Settings.`
    );
  }
  switch (cfg.active) {
    case "gemini":
      return callGemini(key, system, user);
    case "openai":
      return callOpenAICompatible(
        "https://api.openai.com/v1/chat/completions",
        key,
        PROVIDER_INFO.openai.model,
        system,
        user
      );
    case "groq":
      return callOpenAICompatible(
        "https://api.groq.com/openai/v1/chat/completions",
        key,
        PROVIDER_INFO.groq.model,
        system,
        user
      );
    case "anthropic":
      return callAnthropic(key, system, user);
  }
}

export function summarize(text: string): Promise<string> {
  return call(
    "You are a warm, encouraging diary assistant. Given the user's diary entry, write a concise 2-3 sentence summary capturing the main events, actions, and feelings. Use second person ('you did...'). Be supportive. Return only the summary, no preamble.",
    text
  );
}

export function correct(text: string): Promise<string> {
  return call(
    "You are a writing assistant. Fix only grammar, spelling, and punctuation errors in the user's text. Preserve their voice, tone, style, and meaning exactly. Keep paragraphs and line breaks. Do NOT rewrite, expand, or shorten. Return ONLY the corrected text with no explanations, no quotes, no preamble.",
    text
  );
}

(function (global) {
  const KEY_STORAGE = "forgmind.ai.key.v1";
  const MODEL = "gemini-2.0-flash";
  const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models/";

  function getKey() {
    return localStorage.getItem(KEY_STORAGE) || "";
  }

  function setKey(k) {
    if (!k) localStorage.removeItem(KEY_STORAGE);
    else localStorage.setItem(KEY_STORAGE, k.trim());
  }

  function hasKey() {
    return !!getKey();
  }

  async function callGemini(systemPrompt, userText) {
    const key = getKey();
    if (!key) throw new Error("No API key set. Open AI Settings to add one.");

    const url =
      API_BASE + encodeURIComponent(MODEL) + ":generateContent?key=" + encodeURIComponent(key);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.7,
        },
      }),
    });

    if (!res.ok) {
      let msg = "API error " + res.status;
      try {
        const err = await res.json();
        if (err?.error?.message) msg = err.error.message;
      } catch {}
      throw new Error(msg);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!text) {
      const reason = data?.candidates?.[0]?.finishReason || "no content returned";
      throw new Error("AI did not return a response (" + reason + ").");
    }
    return text.trim();
  }

  async function summarize(text) {
    return callGemini(
      "You are a warm, encouraging diary assistant. Given the user's diary entry, write a concise 2-3 sentence summary capturing the main events, actions, and feelings. Use second person ('you did...'). Be supportive. Return only the summary, no preamble.",
      text
    );
  }

  async function correct(text) {
    return callGemini(
      "You are a writing assistant. Fix only grammar, spelling, and punctuation errors in the user's text. Preserve their voice, tone, style, and meaning exactly. Keep paragraphs and line breaks. Do NOT rewrite, expand, or shorten. Return ONLY the corrected text with no explanations, no quotes, no preamble.",
      text
    );
  }

  global.AI = { getKey, setKey, hasKey, summarize, correct, MODEL };
})(window);

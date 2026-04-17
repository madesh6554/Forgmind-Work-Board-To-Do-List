import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { DiaryEntry, DiarySource } from "@/lib/types";
import {
  PROVIDER_INFO,
  PROVIDERS,
  Provider,
  correct,
  getActiveProvider,
  getProviderKey,
  hasActiveKey,
  setActiveAndKey,
  clearProviderKey,
  summarize,
} from "@/lib/ai";
import { Modal } from "@/components/Modal";

type SourceFilter = "all" | DiarySource;
type DateFilter = "all" | "today" | "week" | "month" | "year";

export default function Diary() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [search, setSearch] = useState("");

  const [aiOpen, setAiOpen] = useState(false);
  const [aiLabel, setAiLabel] = useState("");
  const [aiText, setAiText] = useState("");
  const [aiApplyable, setAiApplyable] = useState(false);
  const [aiBusy, setAiBusy] = useState<"summarize" | "correct" | null>(null);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider>(() => getActiveProvider());
  const [keyInput, setKeyInput] = useState("");
  const [keyFlash, setKeyFlash] = useState<{ msg: string; ok: boolean } | null>(null);

  function openSettings() {
    const active = getActiveProvider();
    setSelectedProvider(active);
    setKeyInput(getProviderKey(active));
    setKeyFlash(null);
    setSettingsOpen(true);
  }

  function onProviderChange(p: Provider) {
    setSelectedProvider(p);
    setKeyInput(getProviderKey(p));
    setKeyFlash(null);
  }

  useEffect(() => {
    if (!user) return;
    loadEntries();
  }, [user]);

  async function loadEntries() {
    const { data, error } = await supabase
      .from("diary_entries")
      .select("*")
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      alert("Could not load entries: " + error.message);
      return;
    }
    setEntries((data ?? []) as DiaryEntry[]);
  }

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (sourceFilter !== "all") {
        const src = e.source || "manual";
        if (src !== sourceFilter) return false;
      }
      if (dateFilter !== "all") {
        const entryDate = new Date(e.entry_date + "T00:00:00");
        const now = new Date();
        const diffDays = Math.floor(
          (now.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (dateFilter === "today" && diffDays > 0) return false;
        if (dateFilter === "week" && diffDays > 7) return false;
        if (dateFilter === "month" && diffDays > 30) return false;
        if (dateFilter === "year" && entryDate.getFullYear() !== now.getFullYear())
          return false;
      }
      if (search) {
        const hay = ((e.title || "") + " " + (e.content || "")).toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [entries, sourceFilter, dateFilter, search]);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setContent("");
    setDate(new Date().toISOString().slice(0, 10));
  }

  function clearFilters() {
    setSourceFilter("all");
    setDateFilter("all");
    setSearch("");
  }

  async function saveEntry(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    const c = content.trim();
    if (!c) return;
    setBusy(true);
    if (editingId) {
      const { error } = await supabase
        .from("diary_entries")
        .update({
          title: title.trim() || null,
          content: c,
          entry_date: date,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingId);
      setBusy(false);
      if (error) {
        alert("Could not update: " + error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("diary_entries").insert({
        user_id: user.id,
        title: title.trim() || null,
        content: c,
        entry_date: date,
        source: "manual" as const,
      });
      setBusy(false);
      if (error) {
        alert("Could not save: " + error.message);
        return;
      }
    }
    resetForm();
    loadEntries();
  }

  function beginEdit(entry: DiaryEntry) {
    setEditingId(entry.id);
    setTitle(entry.title || "");
    setContent(entry.content);
    setDate(entry.entry_date);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteEntry(id: string) {
    if (!confirm("Delete this diary entry?")) return;
    const { error } = await supabase.from("diary_entries").delete().eq("id", id);
    if (error) {
      alert("Could not delete: " + error.message);
      return;
    }
    if (editingId === id) resetForm();
    loadEntries();
  }

  async function runAI(kind: "summarize" | "correct") {
    const text = content.trim();
    if (!text) {
      setAiLabel("Error");
      setAiText("Write something first.");
      setAiApplyable(false);
      setAiOpen(true);
      return;
    }
    if (!hasActiveKey()) {
      openSettings();
      return;
    }
    setAiBusy(kind);
    try {
      const result = kind === "summarize" ? await summarize(text) : await correct(text);
      setAiLabel(kind === "summarize" ? "Summary" : "Corrected Text");
      setAiText(result);
      setAiApplyable(kind === "correct");
      setAiOpen(true);
    } catch (err) {
      setAiLabel("Error");
      setAiText(err instanceof Error ? err.message : String(err));
      setAiApplyable(false);
      setAiOpen(true);
    } finally {
      setAiBusy(null);
    }
  }

  function applyAIResult() {
    setContent(aiText);
    setAiOpen(false);
  }

  async function copyAIResult() {
    try {
      await navigator.clipboard.writeText(aiText);
    } catch {
      /* ignore */
    }
  }

  function saveKey() {
    const k = keyInput.trim();
    if (!k) {
      setKeyFlash({ msg: "Enter a key first", ok: false });
      return;
    }
    setActiveAndKey(selectedProvider, k);
    if (getProviderKey(selectedProvider) === k && getActiveProvider() === selectedProvider) {
      setKeyFlash({ msg: "Saved ✓", ok: true });
      setTimeout(() => {
        setSettingsOpen(false);
        setKeyFlash(null);
      }, 700);
    } else {
      setKeyFlash({ msg: "Save failed", ok: false });
    }
  }

  function removeKey() {
    clearProviderKey(selectedProvider);
    setKeyInput("");
    setKeyFlash({ msg: "Key removed", ok: true });
    setTimeout(() => setKeyFlash(null), 1000);
  }

  return (
    <div>
      <section className="mb-5">
        <form
          className="bg-bg-2 border border-line p-3.5 rounded-xl shadow-brand flex flex-col gap-2.5"
          onSubmit={saveEntry}
          autoComplete="off"
        >
          <div className="grid grid-cols-[1fr_180px] gap-2.5 max-md:grid-cols-1">
            <input
              type="text"
              className="input"
              placeholder="Title (optional)"
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <textarea
            className="input resize-y min-h-[120px] leading-relaxed"
            placeholder="Write about your day... what happened, what you worked on, how you felt."
            rows={6}
            maxLength={10000}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
          />

          <div className="flex items-center gap-2 pt-3 border-t border-dashed border-line flex-wrap">
            <button
              type="button"
              className="btn btn-ai"
              onClick={() => runAI("summarize")}
              disabled={aiBusy !== null}
            >
              <span style={{ color: "#ff2a3d" }}>✦</span>{" "}
              {aiBusy === "summarize" ? "Thinking..." : "Summarize"}
            </button>
            <button
              type="button"
              className="btn btn-ai"
              onClick={() => runAI("correct")}
              disabled={aiBusy !== null}
            >
              <span style={{ color: "#ff2a3d" }}>✓</span>{" "}
              {aiBusy === "correct" ? "Thinking..." : "Fix Grammar"}
            </button>
            <div className="flex-1" />
            <button
              type="button"
              className="btn btn-ghost"
              onClick={openSettings}
            >
              ⚙ AI Settings
            </button>
          </div>

          <div className="flex justify-end items-center gap-2.5 mt-1">
            {editingId && <span className="text-xs text-brand-red mr-auto">Editing existing entry</span>}
            {editingId && (
              <button type="button" className="btn btn-ghost" onClick={resetForm}>
                Cancel
              </button>
            )}
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? (editingId ? "Updating..." : "Saving...") : editingId ? "Update Entry" : "Save Entry"}
            </button>
          </div>
        </form>
      </section>

      <section className="card-accent p-[18px]">
        <div className="flex justify-between items-center pb-3.5 border-b border-line mb-3.5">
          <h2 className="text-[15px] font-semibold tracking-wide uppercase">My Diary</h2>
          <span className="chip">
            {filtered.length}
            {filtered.length !== entries.length ? ` / ${entries.length}` : ""}
          </span>
        </div>

        <div className="grid grid-cols-[1fr_1fr_2fr_auto] gap-2.5 items-end mb-4 p-3 bg-bg-1 border border-line rounded-[10px] max-md:grid-cols-2">
          <FilterField label="Type">
            <select
              className="input"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
            >
              <option value="all">All entries</option>
              <option value="manual">My writing</option>
              <option value="task">Task activity</option>
            </select>
          </FilterField>
          <FilterField label="When">
            <select
              className="input"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
            >
              <option value="all">All time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 days</option>
              <option value="month">Last 30 days</option>
              <option value="year">This year</option>
            </select>
          </FilterField>
          <FilterField label="Search" className="max-md:col-span-2">
            <input
              type="search"
              className="input"
              placeholder="Search text..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </FilterField>
          <button
            type="button"
            className="btn btn-ghost max-md:col-span-2"
            onClick={clearFilters}
          >
            Clear
          </button>
        </div>

        {entries.length === 0 ? (
          <EmptyHint text="No entries yet. Write your first diary entry above." />
        ) : filtered.length === 0 ? (
          <EmptyHint text="No entries match your filters." />
        ) : (
          <div className="flex flex-col gap-3.5">
            {filtered.map((e) => (
              <DiaryCard
                key={e.id}
                entry={e}
                onEdit={() => beginEdit(e)}
                onDelete={() => deleteEntry(e.id)}
              />
            ))}
          </div>
        )}
      </section>

      <Modal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        title={aiLabel}
        actions={
          <>
            <button className="btn btn-ghost" onClick={copyAIResult}>
              Copy
            </button>
            {aiApplyable && (
              <button className="btn btn-primary" onClick={applyAIResult}>
                Apply to Entry
              </button>
            )}
          </>
        }
      >
        <div className="text-sm leading-relaxed whitespace-pre-wrap break-words bg-bg-2 p-3 rounded-lg border border-line">
          {aiText}
        </div>
      </Modal>

      <Modal
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          setKeyFlash(null);
        }}
        title="AI Settings"
        subtitle="Pick a provider and enter your key. Keys are stored only in this browser."
        actions={
          <>
            <button
              className="btn btn-ghost mr-auto"
              onClick={removeKey}
              style={
                keyFlash && keyFlash.msg === "Key removed"
                  ? { background: "#2d7d3a", color: "#fff", borderColor: "#2d7d3a" }
                  : undefined
              }
            >
              Remove Key
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setSettingsOpen(false);
                setKeyFlash(null);
              }}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={saveKey}
              style={
                keyFlash
                  ? keyFlash.ok
                    ? { background: "#2d7d3a", borderColor: "#2d7d3a" }
                    : { background: "#8b0714", borderColor: "#8b0714" }
                  : undefined
              }
            >
              {keyFlash ? keyFlash.msg : "Save"}
            </button>
          </>
        }
      >
        <label className="flex flex-col gap-1.5 text-xs text-muted">
          <span>Provider</span>
          <select
            className="input"
            value={selectedProvider}
            onChange={(e) => onProviderChange(e.target.value as Provider)}
          >
            {PROVIDERS.map((p) => {
              const info = PROVIDER_INFO[p];
              const has = !!getProviderKey(p);
              return (
                <option key={p} value={p}>
                  {info.name} {info.free ? "(free)" : "(paid)"} {has ? "• key saved" : ""}
                </option>
              );
            })}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-xs text-muted">
          <span>{PROVIDER_INFO[selectedProvider].name} API Key</span>
          <input
            type="password"
            className="input font-mono tracking-wider"
            placeholder={PROVIDER_INFO[selectedProvider].placeholder}
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            autoComplete="off"
          />
        </label>

        <p className="text-[11px] text-muted leading-relaxed">
          {PROVIDER_INFO[selectedProvider].note} Get a key at{" "}
          <a
            href={PROVIDER_INFO[selectedProvider].keyUrl}
            target="_blank"
            rel="noopener"
            className="text-brand-bright hover:underline"
          >
            {PROVIDER_INFO[selectedProvider].keyUrlLabel}
          </a>
          . Model:{" "}
          <code className="bg-bg-3 px-1.5 py-0.5 rounded text-[11px] border border-line">
            {PROVIDER_INFO[selectedProvider].model}
          </code>
        </p>
      </Modal>
    </div>
  );
}

function FilterField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-[10px] font-bold text-muted tracking-wide uppercase">{label}</label>
      {children}
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="text-center text-muted text-xs p-5 border border-dashed border-line rounded-lg">
      {text}
    </div>
  );
}

function DiaryCard({
  entry,
  onEdit,
  onDelete,
}: {
  entry: DiaryEntry;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isTask = entry.source === "task";
  const saved = new Date(entry.updated_at || entry.created_at);
  const edited = entry.updated_at && entry.updated_at !== entry.created_at;

  return (
    <article
      className="bg-bg-3 border border-line rounded-[10px] p-4 pr-[18px] pl-[18px] flex flex-col gap-2.5 transition hover:border-brand-red hover:shadow-[0_6px_16px_rgba(225,11,31,0.12)]"
      style={{
        borderLeft: `3px solid ${isTask ? "#8b0714" : "#e10b1f"}`,
        ...(isTask
          ? { background: "linear-gradient(180deg, #22222c, rgba(139, 7, 20, 0.06))" }
          : {}),
      }}
    >
      <div className="flex justify-between items-center gap-2.5">
        <div className="text-xs text-brand-red font-semibold tracking-wide uppercase flex items-center gap-1">
          <SourceBadge source={entry.source} />
          <span>&middot;</span>
          <span>{formatLongDate(entry.entry_date)}</span>
        </div>
        <div className="flex gap-1.5">
          <button className="icon-btn" onClick={onEdit}>
            Edit
          </button>
          <button className="icon-btn" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>
      <h3
        className={`text-[17px] leading-tight break-words ${
          entry.title ? "text-white" : "text-muted italic font-medium"
        } ${isTask ? "!text-sm font-semibold" : "font-semibold"}`}
      >
        {entry.title || "(Untitled)"}
      </h3>
      <div
        className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${
          isTask
            ? "text-xs text-muted font-mono bg-bg-1 p-2 pl-2.5 pr-2.5 rounded-md border border-line"
            : "text-white"
        }`}
      >
        {entry.content}
      </div>
      <div className="text-[11px] text-muted">
        {edited ? "Edited " : "Saved "}
        {formatShortTime(saved)}
      </div>
    </article>
  );
}

function SourceBadge({ source }: { source: DiarySource }) {
  const isTask = source === "task";
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border"
      style={
        isTask
          ? {
              color: "#d19099",
              background: "rgba(139, 7, 20, 0.25)",
              borderColor: "rgba(139, 7, 20, 0.4)",
            }
          : {
              color: "#ff2a3d",
              background: "rgba(225, 11, 31, 0.15)",
              borderColor: "rgba(225, 11, 31, 0.4)",
            }
      }
    >
      {isTask ? "Task Activity" : "Diary"}
    </span>
  );
}

function formatLongDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatShortTime(d: Date): string {
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

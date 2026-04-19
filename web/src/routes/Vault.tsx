import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useVault } from "@/contexts/VaultContext";
import { decryptJson, encryptJson } from "@/lib/crypto";
import type {
  VaultEntry,
  VaultEntryPlaintext,
  VaultEntryRow,
} from "@/lib/types";

export default function Vault() {
  const { status } = useVault();
  if (status === "loading") {
    return (
      <div className="text-center text-muted text-sm py-10">Loading vault...</div>
    );
  }
  if (status === "no-vault") return <CreateVaultView />;
  if (status === "locked") return <UnlockView />;
  return <EntriesView />;
}

function CreateVaultView() {
  const { createVault } = useVault();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    if (pw.length < 8) {
      setErr("Master password must be at least 8 characters.");
      return;
    }
    if (pw !== pw2) {
      setErr("Passwords do not match.");
      return;
    }
    setBusy(true);
    const res = await createVault(pw);
    setBusy(false);
    if (!res.ok) setErr(res.error || "Could not create vault.");
  }

  return (
    <div className="max-w-md mx-auto mt-10">
      <div className="card-accent p-6">
        <h2 className="text-lg font-semibold mb-1">Create Your Vault</h2>
        <p className="text-xs text-muted mb-4">
          Choose a <b>master password</b>. It encrypts your saved passwords. It's
          never sent to any server. If you forget it, your data is permanently
          lost — there is no recovery.
        </p>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Field label="Master password (min 8 chars)">
            <input
              type="password"
              className="input font-mono"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm master password">
            <input
              type="password"
              className="input font-mono"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </Field>
          {err && <div className="text-xs text-[#ff8a95]">{err}</div>}
          <button className="btn btn-primary py-3 mt-1" type="submit" disabled={busy}>
            {busy ? "Creating..." : "Create Vault"}
          </button>
        </form>
        <div className="mt-4 text-[11px] text-muted leading-relaxed border-t border-line pt-3">
          <b className="text-white">Security:</b> Your master password is run through PBKDF2
          (250,000 iterations) to derive an AES-GCM key on your device. Only
          encrypted blobs leave the browser. The server can't read your
          passwords.
        </div>
      </div>
    </div>
  );
}

function UnlockView() {
  const { unlock } = useVault();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const res = await unlock(pw);
    setBusy(false);
    if (!res.ok) {
      setErr(res.error || "Unlock failed.");
      setPw("");
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10">
      <div className="card-accent p-6">
        <h2 className="text-lg font-semibold mb-1">Unlock Vault</h2>
        <p className="text-xs text-muted mb-4">
          Enter your master password to decrypt your vault.
        </p>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Field label="Master password">
            <input
              type="password"
              className="input font-mono"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              required
              autoFocus
              autoComplete="current-password"
            />
          </Field>
          {err && <div className="text-xs text-[#ff8a95]">{err}</div>}
          <button className="btn btn-primary py-3 mt-1" type="submit" disabled={busy}>
            {busy ? "Unlocking..." : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}

function EntriesView() {
  const { user } = useAuth();
  const { key, lock } = useVault();
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VaultEntryPlaintext>({
    name: "",
    username: "",
    password: "",
    url: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (key && user) loadEntries();
  }, [key, user]);

  async function loadEntries() {
    if (!key || !user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("vault_entries")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) {
      alert("Could not load vault: " + error.message);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as VaultEntryRow[];
    const decrypted: VaultEntry[] = [];
    for (const row of rows) {
      try {
        const pt = await decryptJson<VaultEntryPlaintext>(
          key,
          row.iv,
          row.ciphertext
        );
        decrypted.push({
          id: row.id,
          ...pt,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      } catch {
        decrypted.push({
          id: row.id,
          name: "[Decryption failed]",
          username: "",
          password: "",
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      }
    }
    setEntries(decrypted);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    if (!search) return entries;
    const q = search.toLowerCase();
    return entries.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.username.toLowerCase().includes(q) ||
        (e.url || "").toLowerCase().includes(q)
    );
  }, [entries, search]);

  function resetForm() {
    setEditingId(null);
    setForm({ name: "", username: "", password: "", url: "", notes: "" });
    setErr("");
  }

  function beginEdit(entry: VaultEntry) {
    setEditingId(entry.id);
    setForm({
      name: entry.name,
      username: entry.username,
      password: entry.password,
      url: entry.url || "",
      notes: entry.notes || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!user || !key) return;
    if (!form.name.trim() || !form.password) {
      setErr("Name and password are required.");
      return;
    }
    setBusy(true);
    setErr("");
    const plaintext: VaultEntryPlaintext = {
      name: form.name.trim(),
      username: form.username.trim(),
      password: form.password,
      url: form.url?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
    };
    try {
      const { iv, ciphertext } = await encryptJson(key, plaintext);
      if (editingId) {
        const { error } = await supabase
          .from("vault_entries")
          .update({
            iv,
            ciphertext,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vault_entries").insert({
          user_id: user.id,
          iv,
          ciphertext,
        });
        if (error) throw error;
      }
      resetForm();
      await loadEntries();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteEntry(id: string) {
    if (!confirm("Delete this entry? This cannot be undone.")) return;
    const { error } = await supabase.from("vault_entries").delete().eq("id", id);
    if (error) {
      alert("Could not delete: " + error.message);
      return;
    }
    if (editingId === id) resetForm();
    loadEntries();
  }

  return (
    <div>
      <section className="mb-5">
        <form
          onSubmit={save}
          className="bg-bg-2 border border-line p-3.5 rounded-xl shadow-brand flex flex-col gap-2.5"
          autoComplete="off"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-wide uppercase text-muted">
              {editingId ? "Edit Entry" : "Add New Entry"}
            </h3>
            <button type="button" className="btn btn-ghost" onClick={lock}>
              🔒 Lock Vault
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5 max-md:grid-cols-1">
            <input
              className="input"
              placeholder="Name (e.g. Gmail, GitHub)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              maxLength={120}
            />
            <input
              className="input"
              placeholder="URL (optional)"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              maxLength={500}
            />
            <input
              className="input"
              placeholder="Username / email"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              maxLength={200}
              autoComplete="off"
            />
            <input
              type="password"
              className="input font-mono"
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              maxLength={500}
              autoComplete="new-password"
            />
          </div>
          <textarea
            className="input min-h-[60px] resize-y"
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            maxLength={2000}
          />
          {err && <div className="text-xs text-[#ff8a95]">{err}</div>}
          <div className="flex justify-end gap-2">
            {editingId && (
              <button type="button" className="btn btn-ghost" onClick={resetForm}>
                Cancel
              </button>
            )}
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy
                ? editingId
                  ? "Updating..."
                  : "Saving..."
                : editingId
                ? "Update Entry"
                : "Save Entry"}
            </button>
          </div>
        </form>
      </section>

      <section className="card-accent p-[18px]">
        <div className="flex justify-between items-center pb-3.5 border-b border-line mb-3.5 gap-3 flex-wrap">
          <h2 className="text-[15px] font-semibold tracking-wide uppercase">
            My Passwords
          </h2>
          <div className="flex items-center gap-3">
            <input
              type="search"
              placeholder="Search..."
              className="input text-sm py-2"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="chip">{filtered.length}</span>
          </div>
        </div>

        {loading ? (
          <EmptyHint text="Decrypting..." />
        ) : entries.length === 0 ? (
          <EmptyHint text="No entries yet. Add your first above." />
        ) : filtered.length === 0 ? (
          <EmptyHint text="No entries match your search." />
        ) : (
          <div className="flex flex-col gap-2.5">
            {filtered.map((e) => (
              <VaultRow
                key={e.id}
                entry={e}
                onEdit={() => beginEdit(e)}
                onDelete={() => deleteEntry(e.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function VaultRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: VaultEntry;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<"user" | "pass" | null>(null);

  async function copy(text: string, which: "user" | "pass") {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      /* ignore */
    }
  }

  return (
    <article
      className="bg-bg-3 border border-line border-l-[3px] rounded-[10px] p-3.5 flex flex-col gap-2 transition hover:border-brand-red hover:shadow-[0_6px_16px_rgba(225,11,31,0.12)]"
      style={{ borderLeftColor: "#e10b1f" }}
    >
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-semibold break-words">{entry.name}</h3>
          {entry.url && (
            <a
              href={
                /^https?:\/\//i.test(entry.url) ? entry.url : `https://${entry.url}`
              }
              target="_blank"
              rel="noopener"
              className="text-xs text-brand-bright hover:underline break-all"
            >
              {entry.url}
            </a>
          )}
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <button className="icon-btn" onClick={onEdit}>
            Edit
          </button>
          <button className="icon-btn" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>

      {entry.username && (
        <Row
          label="Username"
          value={entry.username}
          mono={false}
          action={
            <button
              type="button"
              className="icon-btn"
              onClick={() => copy(entry.username, "user")}
            >
              {copied === "user" ? "Copied" : "Copy"}
            </button>
          }
        />
      )}

      <Row
        label="Password"
        value={revealed ? entry.password : "•".repeat(Math.min(entry.password.length, 16))}
        mono
        action={
          <div className="flex gap-1">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setRevealed(!revealed)}
            >
              {revealed ? "Hide" : "Show"}
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => copy(entry.password, "pass")}
            >
              {copied === "pass" ? "Copied" : "Copy"}
            </button>
          </div>
        }
      />

      {entry.notes && (
        <div className="text-xs text-muted whitespace-pre-wrap break-words mt-1 p-2 bg-bg-1 border border-line rounded">
          {entry.notes}
        </div>
      )}
    </article>
  );
}

function Row({
  label,
  value,
  mono,
  action,
}: {
  label: string;
  value: string;
  mono?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold text-muted tracking-wide uppercase">
          {label}
        </div>
        <div className={`text-sm break-all ${mono ? "font-mono" : ""}`}>{value}</div>
      </div>
      {action}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs text-muted">
      <span>{label}</span>
      {children}
    </label>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="text-center text-muted text-xs p-5 border border-dashed border-line rounded-lg">
      {text}
    </div>
  );
}

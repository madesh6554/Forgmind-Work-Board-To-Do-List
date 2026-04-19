import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

type ExpenseType = "expense" | "income";

interface Expense {
  id: string;
  type: ExpenseType;
  amount: number;
  category: string;
  note: string;
  date: string;
  createdAt: string;
}

const DEFAULT_CATEGORIES = [
  "Food",
  "Transport",
  "Rent",
  "Bills",
  "Shopping",
  "Health",
  "Entertainment",
  "Education",
  "Savings",
  "Other",
];

const CURRENCY_KEY = "forgmind.expenses.currency";

function storageKey(userId: string) {
  return `forgmind.expenses.${userId}`;
}

function loadExpenses(userId: string): Expense[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Expense[];
  } catch {
    return [];
  }
}

function saveExpenses(userId: string, list: Expense[]) {
  localStorage.setItem(storageKey(userId), JSON.stringify(list));
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7);
}

function fmt(currency: string, n: number) {
  const sign = n < 0 ? "-" : "";
  return `${sign}${currency}${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function Expenses() {
  const { user } = useAuth();
  const [items, setItems] = useState<Expense[]>([]);
  const [currency, setCurrency] = useState<string>(
    () => localStorage.getItem(CURRENCY_KEY) || "₹"
  );

  const [type, setType] = useState<ExpenseType>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayStr());
  const [err, setErr] = useState("");

  const [filterMonth, setFilterMonth] = useState<string>(monthKey(todayStr()));
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setItems(loadExpenses(user.id));
  }, [user]);

  useEffect(() => {
    localStorage.setItem(CURRENCY_KEY, currency);
  }, [currency]);

  function persist(next: Expense[]) {
    if (!user) return;
    setItems(next);
    saveExpenses(user.id, next);
  }

  function resetForm() {
    setEditingId(null);
    setType("expense");
    setAmount("");
    setCategory("Food");
    setNote("");
    setDate(todayStr());
    setErr("");
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!isFinite(amt) || amt <= 0) {
      setErr("Enter a valid amount greater than 0.");
      return;
    }
    if (!category.trim()) {
      setErr("Choose a category.");
      return;
    }
    if (editingId) {
      const next = items.map((it) =>
        it.id === editingId
          ? {
              ...it,
              type,
              amount: amt,
              category: category.trim(),
              note: note.trim(),
              date,
            }
          : it
      );
      persist(next);
    } else {
      const entry: Expense = {
        id: crypto.randomUUID(),
        type,
        amount: amt,
        category: category.trim(),
        note: note.trim(),
        date,
        createdAt: new Date().toISOString(),
      };
      persist([entry, ...items]);
    }
    resetForm();
  }

  function beginEdit(entry: Expense) {
    setEditingId(entry.id);
    setType(entry.type);
    setAmount(String(entry.amount));
    setCategory(entry.category);
    setNote(entry.note);
    setDate(entry.date);
    setErr("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function remove(id: string) {
    if (!confirm("Delete this entry?")) return;
    const next = items.filter((i) => i.id !== id);
    persist(next);
    if (editingId === id) resetForm();
  }

  const months = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => set.add(monthKey(i.date)));
    set.add(monthKey(todayStr()));
    return Array.from(set).sort().reverse();
  }, [items]);

  const monthItems = useMemo(
    () =>
      items
        .filter((i) => monthKey(i.date) === filterMonth)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [items, filterMonth]
  );

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    const byCategory: Record<string, number> = {};
    for (const i of monthItems) {
      if (i.type === "income") income += i.amount;
      else {
        expense += i.amount;
        byCategory[i.category] = (byCategory[i.category] || 0) + i.amount;
      }
    }
    const categoryList = Object.entries(byCategory)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
    return {
      income,
      expense,
      balance: income - expense,
      categoryList,
    };
  }, [monthItems]);

  const allTimeTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const i of items) {
      if (i.type === "income") income += i.amount;
      else expense += i.amount;
    }
    return { income, expense, balance: income - expense };
  }, [items]);

  const topCategoryPct = totals.categoryList[0]
    ? Math.round((totals.categoryList[0].total / Math.max(totals.expense, 1)) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-5">
      <section className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
        <StatCard label="Month Income" value={fmt(currency, totals.income)} tone="good" />
        <StatCard label="Month Expense" value={fmt(currency, totals.expense)} tone="bad" />
        <StatCard
          label="Month Balance"
          value={fmt(currency, totals.balance)}
          tone={totals.balance >= 0 ? "good" : "bad"}
        />
        <StatCard
          label="All-time Balance"
          value={fmt(currency, allTimeTotals.balance)}
          tone={allTimeTotals.balance >= 0 ? "good" : "bad"}
        />
      </section>

      <section>
        <form
          onSubmit={submit}
          className="bg-bg-2 border border-line p-3.5 rounded-xl shadow-brand flex flex-col gap-2.5"
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-semibold tracking-wide uppercase text-muted">
              {editingId ? "Edit Entry" : "Add Expense / Income"}
            </h3>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted">Currency</label>
              <input
                className="input text-sm py-1.5 w-16 text-center"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.slice(0, 3))}
                maxLength={3}
              />
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <TypeToggle active={type === "expense"} onClick={() => setType("expense")}>
              Expense
            </TypeToggle>
            <TypeToggle active={type === "income"} onClick={() => setType("income")}>
              Income
            </TypeToggle>
          </div>

          <div className="grid grid-cols-4 gap-2.5 max-md:grid-cols-2">
            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <input
              className="input"
              list="expense-categories"
              placeholder="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              maxLength={40}
            />
            <datalist id="expense-categories">
              {DEFAULT_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <input
              className="input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            <input
              className="input"
              placeholder="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
            />
          </div>

          {err && <div className="text-xs text-[#ff8a95]">{err}</div>}

          <div className="flex justify-end gap-2">
            {editingId && (
              <button type="button" className="btn btn-ghost" onClick={resetForm}>
                Cancel
              </button>
            )}
            <button type="submit" className="btn btn-primary">
              {editingId ? "Update" : "Add"}
            </button>
          </div>
        </form>
      </section>

      <section className="card-accent p-[18px]">
        <div className="flex justify-between items-center pb-3.5 border-b border-line mb-3.5 gap-3 flex-wrap">
          <h2 className="text-[15px] font-semibold tracking-wide uppercase">
            By Category ({filterMonth})
          </h2>
          <select
            className="input text-sm py-2 w-auto"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {totals.categoryList.length === 0 ? (
          <EmptyHint text="No expenses this month." />
        ) : (
          <div className="flex flex-col gap-2">
            {totals.categoryList.map((c) => {
              const pct = totals.expense
                ? Math.round((c.total / totals.expense) * 100)
                : 0;
              return (
                <div key={c.name} className="flex flex-col gap-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-muted">
                      {fmt(currency, c.total)} &middot; {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-bg-3 rounded overflow-hidden">
                    <div
                      className="h-full"
                      style={{
                        width: `${pct}%`,
                        background: "linear-gradient(90deg, #e10b1f, #ff5a6a)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
            {totals.categoryList[0] && (
              <p className="text-xs text-muted mt-2">
                Top category: <b className="text-white">{totals.categoryList[0].name}</b>{" "}
                ({topCategoryPct}% of month expenses)
              </p>
            )}
          </div>
        )}
      </section>

      <section className="card-accent p-[18px]">
        <div className="flex justify-between items-center pb-3.5 border-b border-line mb-3.5 gap-3 flex-wrap">
          <h2 className="text-[15px] font-semibold tracking-wide uppercase">
            Entries ({filterMonth})
          </h2>
          <span className="chip">{monthItems.length}</span>
        </div>

        {monthItems.length === 0 ? (
          <EmptyHint text="No entries yet for this month." />
        ) : (
          <div className="flex flex-col gap-2.5">
            {monthItems.map((it) => (
              <article
                key={it.id}
                className="bg-bg-3 border border-line border-l-[3px] rounded-[10px] p-3 flex justify-between items-center gap-3 flex-wrap"
                style={{
                  borderLeftColor: it.type === "income" ? "#6be675" : "#e10b1f",
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[15px] font-semibold">
                      {it.type === "income" ? "+" : "-"}
                      {fmt(currency, it.amount)}
                    </span>
                    <span className="chip text-[10px]">{it.category}</span>
                    <span className="text-xs text-muted">{it.date}</span>
                  </div>
                  {it.note && (
                    <div className="text-xs text-muted mt-1 break-words">{it.note}</div>
                  )}
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button className="icon-btn" onClick={() => beginEdit(it)}>
                    Edit
                  </button>
                  <button className="icon-btn" onClick={() => remove(it.id)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "bad";
}) {
  return (
    <div className="bg-bg-2 border border-line rounded-xl p-3.5 shadow-brand">
      <div className="text-[10px] font-bold text-muted tracking-wide uppercase">
        {label}
      </div>
      <div
        className="text-xl font-semibold mt-1 break-all"
        style={{ color: tone === "good" ? "#6be675" : "#ff5a6a" }}
      >
        {value}
      </div>
    </div>
  );
}

function TypeToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-full border text-sm font-semibold transition ${
        active
          ? "border-brand-red text-white bg-brand-soft"
          : "border-line text-muted hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="text-center text-muted text-xs p-5 border border-dashed border-line rounded-lg">
      {text}
    </div>
  );
}

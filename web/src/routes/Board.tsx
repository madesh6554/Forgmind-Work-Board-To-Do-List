import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Task, Priority, ColumnKey, COLUMN_LABEL } from "@/lib/types";

const COLUMNS: ColumnKey[] = ["start", "progress", "completed"];

const DOT_COLOR: Record<ColumnKey, string> = {
  start: "#ff5a6a",
  progress: "#e10b1f",
  completed: "#6be675",
};

const PRIORITY_COLOR: Record<Priority, string> = {
  high: "#ff2a3d",
  medium: "#e10b1f",
  low: "#8b0714",
};

export default function Board() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [text, setText] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [column, setColumn] = useState<ColumnKey>("start");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<ColumnKey | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadTasks();
  }, [user]);

  async function loadTasks() {
    setLoading(true);
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: true });
    setLoading(false);
    if (error) {
      alert("Could not load tasks: " + error.message);
      return;
    }
    setTasks((data ?? []) as Task[]);
  }

  async function logTaskActivity(
    action: "added" | "moved" | "completed" | "edited" | "deleted",
    task: { text: string; priority: Priority; column_name: ColumnKey },
    extra?: string
  ) {
    if (!user) return;
    const icons: Record<typeof action, string> = {
      added: "+",
      moved: "->",
      completed: "✓",
      edited: "~",
      deleted: "x",
    };
    const verb: Record<typeof action, string> = {
      added: "Added task",
      moved: "Moved task",
      completed: "Completed task",
      edited: "Edited task",
      deleted: "Deleted task",
    };
    const title = `[${icons[action]}] ${verb[action]}: ${task.text}`;
    const lines = [
      `Task: ${task.text}`,
      `Priority: ${task.priority}`,
      `Status: ${COLUMN_LABEL[task.column_name]}`,
    ];
    if (extra) lines.push(extra);
    lines.push(`Time: ${new Date().toLocaleString()}`);

    const payload = {
      user_id: user.id,
      title,
      content: lines.join("\n"),
      entry_date: new Date().toISOString().slice(0, 10),
      source: "task" as const,
    };
    const { error } = await supabase.from("diary_entries").insert(payload);
    if (error) console.warn("Diary log failed:", error.message);
  }

  async function addTask(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !user) return;
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: user.id,
        text: trimmed,
        priority,
        column_name: column,
      })
      .select()
      .single();
    if (error) {
      alert("Could not add: " + error.message);
      return;
    }
    const newTask = data as Task;
    setTasks((ts) => [...ts, newTask]);
    setText("");
    logTaskActivity("added", newTask);
  }

  async function deleteTask(task: Task) {
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (error) {
      alert("Could not delete: " + error.message);
      return;
    }
    setTasks((ts) => ts.filter((t) => t.id !== task.id));
    logTaskActivity("deleted", task);
  }

  async function editTask(task: Task) {
    const next = prompt("Edit task:", task.text);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed) return;
    const { error } = await supabase.from("tasks").update({ text: trimmed }).eq("id", task.id);
    if (error) {
      alert("Could not update: " + error.message);
      return;
    }
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, text: trimmed } : t)));
    logTaskActivity("edited", { ...task, text: trimmed }, `Previous text: ${task.text}`);
  }

  async function moveTask(task: Task, to: ColumnKey) {
    if (task.column_name === to) return;
    const from = task.column_name;
    setTasks((ts) =>
      ts.map((t) => (t.id === task.id ? { ...t, column_name: to } : t))
    );
    const { error } = await supabase
      .from("tasks")
      .update({ column_name: to })
      .eq("id", task.id);
    if (error) {
      setTasks((ts) =>
        ts.map((t) => (t.id === task.id ? { ...t, column_name: from } : t))
      );
      alert("Could not move: " + error.message);
      return;
    }
    const action = to === "completed" ? "completed" : "moved";
    const extra = `From: ${COLUMN_LABEL[from]} -> To: ${COLUMN_LABEL[to]}`;
    logTaskActivity(action, { ...task, column_name: to }, extra);
  }

  async function clearAll() {
    if (!user || tasks.length === 0) return;
    if (!confirm("Delete all your tasks? This cannot be undone.")) return;
    const { error } = await supabase.from("tasks").delete().eq("user_id", user.id);
    if (error) {
      alert("Could not clear: " + error.message);
      return;
    }
    setTasks([]);
  }

  return (
    <div>
      <section className="mb-5">
        <form
          onSubmit={addTask}
          className="grid grid-cols-[1fr_140px_170px_auto] gap-2.5 bg-bg-2 border border-line p-3 rounded-xl shadow-brand max-md:grid-cols-2"
          autoComplete="off"
        >
          <input
            className="input max-md:col-span-2"
            placeholder="What do you need to do?"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={200}
            required
          />
          <select
            className="input"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <select
            className="input"
            value={column}
            onChange={(e) => setColumn(e.target.value as ColumnKey)}
          >
            {COLUMNS.map((c) => (
              <option key={c} value={c}>
                {COLUMN_LABEL[c]}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" type="submit">
            Add Task
          </button>
        </form>
        <div className="flex justify-end mt-2">
          <button className="btn btn-ghost" type="button" onClick={clearAll}>
            Clear All
          </button>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-4 items-start max-md:grid-cols-1">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.column_name === col);
          const isOver = dragOver === col;
          return (
            <div key={col} className="card-accent flex flex-col min-h-[480px] overflow-hidden">
              <div className="flex justify-between items-center px-[18px] py-4 border-b border-line bg-white/[0.015]">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{
                      background: DOT_COLOR[col],
                      boxShadow: `0 0 10px ${DOT_COLOR[col]}`,
                    }}
                  />
                  <h2 className="text-[15px] font-semibold tracking-wide uppercase">
                    {COLUMN_LABEL[col]}
                  </h2>
                </div>
                <span className="chip">{colTasks.length}</span>
              </div>
              <div
                className={`flex-1 p-3.5 flex flex-col gap-2.5 min-h-[150px] transition-colors rounded-b-xl ${
                  isOver
                    ? "bg-brand-soft outline-dashed outline-2 -outline-offset-[10px] outline-brand-red"
                    : ""
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragOver(col);
                }}
                onDragLeave={(e) => {
                  if (e.target === e.currentTarget) setDragOver(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(null);
                  const id = draggingId || e.dataTransfer.getData("text/plain");
                  const task = tasks.find((t) => t.id === id);
                  if (task) moveTask(task, col);
                }}
              >
                {colTasks.length === 0 ? (
                  <div className="text-center text-muted text-xs p-5 border border-dashed border-line rounded-lg my-auto">
                    {col === "start"
                      ? loading
                        ? "Loading..."
                        : "No tasks yet. Add one above."
                      : col === "progress"
                      ? "Drag tasks here when you start working."
                      : "Drag completed tasks here."}
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      dragging={draggingId === task.id}
                      onDragStart={() => setDraggingId(task.id)}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDragOver(null);
                      }}
                      onEdit={() => editTask(task)}
                      onDelete={() => deleteTask(task)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function TaskCard({
  task,
  dragging,
  onDragStart,
  onDragEnd,
  onEdit,
  onDelete,
}: {
  task: Task;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isCompleted = task.column_name === "completed";
  return (
    <div
      draggable
      onDragStart={(e) => {
        onDragStart();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", task.id);
      }}
      onDragEnd={onDragEnd}
      className={`bg-bg-3 border border-line p-3 pl-3.5 pr-3.5 rounded-[10px] cursor-grab select-none transition flex flex-col gap-2 hover:border-brand-red hover:shadow-[0_6px_16px_rgba(225,11,31,0.15)] ${
        dragging ? "opacity-50 scale-[0.98] cursor-grabbing" : ""
      }`}
      style={{ borderLeft: `3px solid ${PRIORITY_COLOR[task.priority]}` }}
    >
      <div
        className={`text-sm leading-[1.45] break-words ${
          isCompleted ? "line-through text-muted" : ""
        }`}
      >
        {task.text}
      </div>
      <div className="flex justify-between items-center text-[11px] text-muted">
        <div className="flex gap-2 items-center">
          <PriorityBadge priority={task.priority} />
          <span>{formatDate(task.created_at)}</span>
        </div>
        <div className="flex gap-1.5">
          <button className="icon-btn" type="button" onClick={onEdit}>
            Edit
          </button>
          <button className="icon-btn" type="button" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const colors: Record<Priority, { bg: string; color: string; border: string }> = {
    high: {
      bg: "rgba(255, 42, 61, 0.18)",
      color: "#ff8a95",
      border: "rgba(255, 42, 61, 0.4)",
    },
    medium: {
      bg: "rgba(225, 11, 31, 0.15)",
      color: "#ff9ba4",
      border: "rgba(225, 11, 31, 0.35)",
    },
    low: {
      bg: "rgba(139, 7, 20, 0.25)",
      color: "#d19099",
      border: "rgba(139, 7, 20, 0.4)",
    },
  };
  const c = colors[priority];
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px] tracking-[0.5px] uppercase font-bold border"
      style={{ background: c.bg, color: c.color, borderColor: c.border }}
    >
      {priority}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

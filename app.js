(async function () {
  const logged = await Auth.requireLogin();
  if (!logged) return;

  document.body.style.visibility = "visible";

  const form = document.getElementById("taskForm");
  const input = document.getElementById("taskInput");
  const prioritySel = document.getElementById("taskPriority");
  const columnSel = document.getElementById("taskColumn");
  const clearAllBtn = document.getElementById("clearAllBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const userBadge = document.getElementById("userBadge");
  const dropZones = document.querySelectorAll(".task-list");

  const user = await Auth.currentUser();
  if (userBadge && user) {
    userBadge.textContent = user.email;
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await Auth.logout();
      window.location.replace("login.html");
    });
  }

  let tasks = [];

  const COLUMN_LABEL = {
    start: "Work Start",
    progress: "In Progress",
    completed: "Completed",
  };

  async function logTaskActivity(action, task, extra) {
    const icons = { added: "+", moved: "->", completed: "✓", edited: "~", deleted: "x" };
    const verb = {
      added: "Added task",
      moved: "Moved task",
      completed: "Completed task",
      edited: "Edited task",
      deleted: "Deleted task",
    }[action];
    const title = `[${icons[action]}] ${verb}: ${task.text}`;
    const lines = [
      `Task: ${task.text}`,
      `Priority: ${task.priority}`,
      `Status: ${COLUMN_LABEL[task.column] || task.column}`,
    ];
    if (extra) lines.push(extra);
    lines.push(`Time: ${new Date().toLocaleString()}`);

    const payload = {
      user_id: user.id,
      title,
      content: lines.join("\n"),
      entry_date: new Date().toISOString().slice(0, 10),
      source: "task",
    };
    let { error } = await sb.from("diary_entries").insert(payload);

    if (error && /source/i.test(error.message)) {
      console.warn("source column missing, retrying without it. Run the migration SQL!", error.message);
      delete payload.source;
      ({ error } = await sb.from("diary_entries").insert(payload));
    }

    if (error) {
      console.error("Diary log failed:", error);
      alert("Task saved, but diary log failed: " + error.message);
    }
  }

  function fromRow(row) {
    return {
      id: row.id,
      text: row.text,
      priority: row.priority,
      column: row.column_name,
      createdAt: new Date(row.created_at).getTime(),
    };
  }

  async function loadTasks() {
    const { data, error } = await sb
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Load failed:", error);
      alert("Could not load tasks: " + error.message);
      return;
    }
    tasks = data.map(fromRow);
    render();
  }

  async function addTask(text, priority, column) {
    const { data, error } = await sb
      .from("tasks")
      .insert({
        user_id: user.id,
        text: text.trim(),
        priority,
        column_name: column,
      })
      .select()
      .single();
    if (error) {
      alert("Could not add task: " + error.message);
      return;
    }
    const newTask = fromRow(data);
    tasks.push(newTask);
    render();
    logTaskActivity("added", newTask);
  }

  async function deleteTask(id) {
    const task = tasks.find((t) => t.id === id);
    const { error } = await sb.from("tasks").delete().eq("id", id);
    if (error) {
      alert("Could not delete: " + error.message);
      return;
    }
    tasks = tasks.filter((t) => t.id !== id);
    render();
    if (task) logTaskActivity("deleted", task);
  }

  async function editTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const next = prompt("Edit task:", task.text);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed) return;
    const previousText = task.text;
    const { error } = await sb.from("tasks").update({ text: trimmed }).eq("id", id);
    if (error) {
      alert("Could not update: " + error.message);
      return;
    }
    task.text = trimmed;
    render();
    logTaskActivity("edited", task, `Previous text: ${previousText}`);
  }

  async function moveTask(id, toColumn) {
    const task = tasks.find((t) => t.id === id);
    if (!task || task.column === toColumn) return;
    const previous = task.column;
    task.column = toColumn;
    render();
    const { error } = await sb
      .from("tasks")
      .update({ column_name: toColumn })
      .eq("id", id);
    if (error) {
      task.column = previous;
      render();
      alert("Could not move task: " + error.message);
      return;
    }
    const action = toColumn === "completed" ? "completed" : "moved";
    const extra = `From: ${COLUMN_LABEL[previous]} -> To: ${COLUMN_LABEL[toColumn]}`;
    logTaskActivity(action, task, extra);
  }

  async function clearAllTasks() {
    if (tasks.length === 0) return;
    if (!confirm("Delete all your tasks? This cannot be undone.")) return;
    const { error } = await sb.from("tasks").delete().eq("user_id", user.id);
    if (error) {
      alert("Could not clear: " + error.message);
      return;
    }
    tasks = [];
    render();
  }

  function formatDate(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function render() {
    dropZones.forEach((zone) => {
      const col = zone.dataset.droppable;
      zone.innerHTML = "";
      const colTasks = tasks.filter((t) => t.column === col);

      if (colTasks.length === 0) {
        const hint = document.createElement("div");
        hint.className = "empty-hint";
        hint.textContent =
          col === "start"
            ? "No tasks yet. Add one above."
            : col === "progress"
            ? "Drag tasks here when you start working."
            : "Drag completed tasks here.";
        zone.appendChild(hint);
      } else {
        colTasks.forEach((task) => zone.appendChild(buildTaskEl(task)));
      }

      const counter = document.querySelector(`[data-count="${col}"]`);
      if (counter) counter.textContent = colTasks.length;
    });
  }

  function buildTaskEl(task) {
    const el = document.createElement("div");
    el.className = "task task-priority-" + task.priority;
    if (task.column === "completed") el.classList.add("task-completed");
    el.setAttribute("draggable", "true");
    el.dataset.id = task.id;

    const text = document.createElement("div");
    text.className = "task-text";
    text.textContent = task.text;

    const meta = document.createElement("div");
    meta.className = "task-meta";

    const left = document.createElement("div");
    left.style.display = "flex";
    left.style.gap = "8px";
    left.style.alignItems = "center";

    const badge = document.createElement("span");
    badge.className = "priority-badge " + task.priority;
    badge.textContent = task.priority;

    const date = document.createElement("span");
    date.textContent = formatDate(task.createdAt);

    left.appendChild(badge);
    left.appendChild(date);

    const actions = document.createElement("div");
    actions.className = "task-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "icon-btn";
    editBtn.type = "button";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => editTask(task.id));

    const delBtn = document.createElement("button");
    delBtn.className = "icon-btn";
    delBtn.type = "button";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => deleteTask(task.id));

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    meta.appendChild(left);
    meta.appendChild(actions);

    el.appendChild(text);
    el.appendChild(meta);

    el.addEventListener("dragstart", onDragStart);
    el.addEventListener("dragend", onDragEnd);

    return el;
  }

  let draggedId = null;

  function onDragStart(e) {
    draggedId = this.dataset.id;
    this.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", draggedId);
  }

  function onDragEnd() {
    this.classList.remove("dragging");
    draggedId = null;
    dropZones.forEach((z) => z.classList.remove("drag-over"));
  }

  dropZones.forEach((zone) => {
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      zone.classList.add("drag-over");
    });
    zone.addEventListener("dragleave", (e) => {
      if (e.target === zone) zone.classList.remove("drag-over");
    });
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("drag-over");
      const id = draggedId || e.dataTransfer.getData("text/plain");
      if (id) moveTask(id, zone.dataset.droppable);
    });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    addTask(text, prioritySel.value, columnSel.value);
    input.value = "";
    input.focus();
  });

  clearAllBtn.addEventListener("click", clearAllTasks);

  await loadTasks();
})();

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
    tasks.push(fromRow(data));
    render();
  }

  async function deleteTask(id) {
    const { error } = await sb.from("tasks").delete().eq("id", id);
    if (error) {
      alert("Could not delete: " + error.message);
      return;
    }
    tasks = tasks.filter((t) => t.id !== id);
    render();
  }

  async function editTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const next = prompt("Edit task:", task.text);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed) return;
    const { error } = await sb.from("tasks").update({ text: trimmed }).eq("id", id);
    if (error) {
      alert("Could not update: " + error.message);
      return;
    }
    task.text = trimmed;
    render();
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
    }
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

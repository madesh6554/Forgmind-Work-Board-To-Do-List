(function () {
  const STORAGE_KEY = "forgmind.workboard.v1";

  const form = document.getElementById("taskForm");
  const input = document.getElementById("taskInput");
  const prioritySel = document.getElementById("taskPriority");
  const columnSel = document.getElementById("taskColumn");
  const clearAllBtn = document.getElementById("clearAllBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const userBadge = document.getElementById("userBadge");
  const dropZones = document.querySelectorAll(".task-list");

  if (userBadge && window.Auth) {
    const name = Auth.currentUser();
    if (name) userBadge.textContent = "@" + name;
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      if (window.Auth) Auth.logout();
      window.location.replace("login.html");
    });
  }

  let tasks = loadTasks();

  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveTasks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
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

  function addTask(text, priority, column) {
    tasks.push({
      id: uid(),
      text: text.trim(),
      priority,
      column,
      createdAt: Date.now(),
    });
    saveTasks();
    render();
  }

  function deleteTask(id) {
    tasks = tasks.filter((t) => t.id !== id);
    saveTasks();
    render();
  }

  function editTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const next = prompt("Edit task:", task.text);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed) return;
    task.text = trimmed;
    saveTasks();
    render();
  }

  function moveTask(id, toColumn) {
    const task = tasks.find((t) => t.id === id);
    if (!task || task.column === toColumn) return;
    task.column = toColumn;
    saveTasks();
    render();
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

  clearAllBtn.addEventListener("click", () => {
    if (tasks.length === 0) return;
    if (confirm("Delete all tasks? This cannot be undone.")) {
      tasks = [];
      saveTasks();
      render();
    }
  });

  render();
})();

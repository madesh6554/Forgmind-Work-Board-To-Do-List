(async function () {
  const logged = await Auth.requireLogin();
  if (!logged) return;

  document.body.style.visibility = "visible";

  const form = document.getElementById("entryForm");
  const titleInput = document.getElementById("entryTitle");
  const dateInput = document.getElementById("entryDate");
  const contentInput = document.getElementById("entryContent");
  const saveBtn = document.getElementById("saveBtn");
  const cancelEditBtn = document.getElementById("cancelEditBtn");
  const editHint = document.getElementById("editHint");
  const list = document.getElementById("diaryList");
  const countEl = document.getElementById("entryCount");
  const userBadge = document.getElementById("userBadge");
  const logoutBtn = document.getElementById("logoutBtn");

  const user = await Auth.currentUser();
  if (userBadge && user) userBadge.textContent = user.email;

  logoutBtn.addEventListener("click", async () => {
    await Auth.logout();
    window.location.replace("login.html");
  });

  dateInput.value = new Date().toISOString().slice(0, 10);

  let entries = [];
  let editingId = null;

  const filterSource = document.getElementById("filterSource");
  const filterDate = document.getElementById("filterDate");
  const filterSearch = document.getElementById("filterSearch");
  const clearFiltersBtn = document.getElementById("clearFiltersBtn");

  const filters = { source: "all", date: "all", search: "" };

  filterSource.addEventListener("change", () => {
    filters.source = filterSource.value;
    render();
  });
  filterDate.addEventListener("change", () => {
    filters.date = filterDate.value;
    render();
  });
  filterSearch.addEventListener("input", () => {
    filters.search = filterSearch.value.trim().toLowerCase();
    render();
  });
  clearFiltersBtn.addEventListener("click", () => {
    filters.source = "all";
    filters.date = "all";
    filters.search = "";
    filterSource.value = "all";
    filterDate.value = "all";
    filterSearch.value = "";
    render();
  });

  function passesFilters(entry) {
    if (filters.source !== "all") {
      const src = entry.source || "manual";
      if (src !== filters.source) return false;
    }
    if (filters.date !== "all") {
      const now = new Date();
      const entryDate = new Date(entry.entry_date + "T00:00:00");
      const diffDays = Math.floor((now - entryDate) / (1000 * 60 * 60 * 24));
      if (filters.date === "today" && diffDays > 0) return false;
      if (filters.date === "week" && diffDays > 7) return false;
      if (filters.date === "month" && diffDays > 30) return false;
      if (filters.date === "year" && entryDate.getFullYear() !== now.getFullYear()) return false;
    }
    if (filters.search) {
      const hay = ((entry.title || "") + " " + (entry.content || "")).toLowerCase();
      if (!hay.includes(filters.search)) return false;
    }
    return true;
  }

  async function loadEntries() {
    const { data, error } = await sb
      .from("diary_entries")
      .select("*")
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      alert("Could not load entries: " + error.message);
      return;
    }
    entries = data;
    render();
  }

  async function saveEntry(e) {
    e.preventDefault();
    const title = titleInput.value.trim() || null;
    const content = contentInput.value.trim();
    const entry_date = dateInput.value;
    if (!content) return;

    saveBtn.disabled = true;
    saveBtn.textContent = editingId ? "Updating..." : "Saving...";

    if (editingId) {
      const { error } = await sb
        .from("diary_entries")
        .update({ title, content, entry_date, updated_at: new Date().toISOString() })
        .eq("id", editingId);
      if (error) {
        alert("Could not update: " + error.message);
        resetSaveBtn();
        return;
      }
    } else {
      const { error } = await sb.from("diary_entries").insert({
        user_id: user.id,
        title,
        content,
        entry_date,
      });
      if (error) {
        alert("Could not save: " + error.message);
        resetSaveBtn();
        return;
      }
    }

    resetForm();
    await loadEntries();
  }

  function resetSaveBtn() {
    saveBtn.disabled = false;
    saveBtn.textContent = editingId ? "Update Entry" : "Save Entry";
  }

  function resetForm() {
    editingId = null;
    titleInput.value = "";
    contentInput.value = "";
    dateInput.value = new Date().toISOString().slice(0, 10);
    saveBtn.textContent = "Save Entry";
    saveBtn.disabled = false;
    cancelEditBtn.hidden = true;
    editHint.hidden = true;
  }

  function beginEdit(id) {
    const e = entries.find((x) => x.id === id);
    if (!e) return;
    editingId = id;
    titleInput.value = e.title || "";
    contentInput.value = e.content;
    dateInput.value = e.entry_date;
    saveBtn.textContent = "Update Entry";
    cancelEditBtn.hidden = false;
    editHint.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
    titleInput.focus();
  }

  async function deleteEntry(id) {
    if (!confirm("Delete this diary entry? This cannot be undone.")) return;
    const { error } = await sb.from("diary_entries").delete().eq("id", id);
    if (error) {
      alert("Could not delete: " + error.message);
      return;
    }
    if (editingId === id) resetForm();
    await loadEntries();
  }

  function formatLongDate(iso) {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function formatShortTime(iso) {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function render() {
    list.innerHTML = "";
    const visible = entries.filter(passesFilters);
    countEl.textContent = `${visible.length}${
      visible.length !== entries.length ? " / " + entries.length : ""
    }`;

    if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-hint";
      empty.textContent = "No entries yet. Write your first diary entry above.";
      list.appendChild(empty);
      return;
    }

    if (visible.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-hint";
      empty.textContent = "No entries match your filters.";
      list.appendChild(empty);
      return;
    }

    visible.forEach((e) => {
      const card = document.createElement("article");
      card.className = "diary-entry";
      if (e.source === "task") card.classList.add("diary-entry-task");

      const head = document.createElement("div");
      head.className = "diary-entry-head";

      const dateEl = document.createElement("div");
      dateEl.className = "diary-entry-date";
      const sourceLabel =
        e.source === "task"
          ? '<span class="source-badge task">Task Activity</span>'
          : '<span class="source-badge manual">Diary</span>';
      dateEl.innerHTML = sourceLabel + " &middot; " + formatLongDate(e.entry_date);

      const actions = document.createElement("div");
      actions.className = "task-actions";

      const editBtn = document.createElement("button");
      editBtn.className = "icon-btn";
      editBtn.type = "button";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => beginEdit(e.id));

      const delBtn = document.createElement("button");
      delBtn.className = "icon-btn";
      delBtn.type = "button";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", () => deleteEntry(e.id));

      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      head.appendChild(dateEl);
      head.appendChild(actions);

      const title = document.createElement("h3");
      title.className = "diary-entry-title";
      title.textContent = e.title || "(Untitled)";
      if (!e.title) title.classList.add("untitled");

      const content = document.createElement("div");
      content.className = "diary-entry-content";
      content.textContent = e.content;

      const foot = document.createElement("div");
      foot.className = "diary-entry-foot";
      const saved = new Date(e.updated_at || e.created_at);
      foot.textContent =
        (e.updated_at && e.updated_at !== e.created_at ? "Edited " : "Saved ") +
        formatShortTime(saved.toISOString());

      card.appendChild(head);
      card.appendChild(title);
      card.appendChild(content);
      card.appendChild(foot);

      list.appendChild(card);
    });
  }

  form.addEventListener("submit", saveEntry);
  cancelEditBtn.addEventListener("click", resetForm);

  setupAI();

  await loadEntries();

  function setupAI() {
    const summarizeBtn = document.getElementById("aiSummarizeBtn");
    const correctBtn = document.getElementById("aiCorrectBtn");
    const settingsBtn = document.getElementById("aiSettingsBtn");
    const resultPanel = document.getElementById("aiResult");
    const resultLabel = document.getElementById("aiResultLabel");
    const resultBody = document.getElementById("aiResultBody");
    const applyBtn = document.getElementById("aiApplyBtn");
    const copyBtn = document.getElementById("aiCopyBtn");
    const closeBtn = document.getElementById("aiCloseBtn");

    const modal = document.getElementById("settingsModal");
    const apiKeyInput = document.getElementById("apiKeyInput");
    const saveKeyBtn = document.getElementById("saveKeyBtn");
    const clearKeyBtn = document.getElementById("clearKeyBtn");
    const modelName = document.getElementById("aiModelName");
    if (modelName) modelName.textContent = AI.MODEL;

    function openModal() {
      apiKeyInput.value = AI.getKey();
      modal.hidden = false;
      setTimeout(() => apiKeyInput.focus(), 50);
    }
    function closeModal() {
      modal.hidden = true;
    }
    modal.addEventListener("click", (e) => {
      if (e.target.dataset.close) closeModal();
    });
    settingsBtn.addEventListener("click", openModal);

    saveKeyBtn.addEventListener("click", () => {
      const key = apiKeyInput.value.trim();
      if (!key) {
        flashBtn(saveKeyBtn, "Enter a key first", true);
        return;
      }
      try {
        AI.setKey(key);
      } catch (err) {
        flashBtn(saveKeyBtn, "Save failed", true);
        return;
      }
      const stored = AI.getKey();
      if (stored === key) {
        flashBtn(saveKeyBtn, "Saved \u2713", false);
        setTimeout(closeModal, 700);
      } else {
        flashBtn(saveKeyBtn, "Save failed", true);
      }
    });

    clearKeyBtn.addEventListener("click", () => {
      AI.setKey("");
      apiKeyInput.value = "";
      flashBtn(clearKeyBtn, "Key removed", false);
    });

    function flashBtn(btn, text, isError) {
      const original = btn.textContent;
      btn.textContent = text;
      btn.classList.toggle("btn-flash-error", !!isError);
      btn.classList.toggle("btn-flash-ok", !isError);
      btn.disabled = true;
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove("btn-flash-error", "btn-flash-ok");
        btn.disabled = false;
      }, 1200);
    }

    function showResult(label, text, { allowApply }) {
      resultLabel.textContent = label;
      resultBody.textContent = text;
      applyBtn.hidden = !allowApply;
      resultPanel.hidden = false;
      resultPanel.dataset.pendingText = allowApply ? text : "";
      resultPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function showError(msg) {
      showResult("Error", msg, { allowApply: false });
    }

    closeBtn.addEventListener("click", () => {
      resultPanel.hidden = true;
    });

    copyBtn.addEventListener("click", async () => {
      const text = resultBody.textContent;
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        copyBtn.textContent = "Copied";
        setTimeout(() => (copyBtn.textContent = "Copy"), 1200);
      } catch {
        alert("Could not copy to clipboard.");
      }
    });

    applyBtn.addEventListener("click", () => {
      const text = resultPanel.dataset.pendingText;
      if (!text) return;
      contentInput.value = text;
      resultPanel.hidden = true;
      contentInput.focus();
    });

    async function runAI(action, label, allowApply, btn) {
      const text = contentInput.value.trim();
      if (!text) {
        showError("Write something first, then try again.");
        return;
      }
      if (!AI.hasKey()) {
        openModal();
        return;
      }
      const original = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = "<span class=\"ai-icon\">&#8987;</span> Thinking...";
      try {
        const result = await action(text);
        showResult(label, result, { allowApply });
      } catch (err) {
        showError(err.message || "Something went wrong.");
      } finally {
        btn.disabled = false;
        btn.innerHTML = original;
      }
    }

    summarizeBtn.addEventListener("click", () =>
      runAI(AI.summarize.bind(AI), "Summary", false, summarizeBtn)
    );
    correctBtn.addEventListener("click", () =>
      runAI(AI.correct.bind(AI), "Corrected Text", true, correctBtn)
    );
  }
})();

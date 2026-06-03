(function () {
  const HERBS = Array.isArray(window.HERB_DATA) ? window.HERB_DATA : [];
  const STORE_KEY = "herb-discrimination-trainer-v1";
  const TOTAL = HERBS.length;

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const els = {
    saveStatus: $("#saveStatus"),
    exportBtn: $("#exportBtn"),
    importBtn: $("#importBtn"),
    importFile: $("#importFile"),
    resetBtn: $("#resetBtn"),
    tabs: $$(".mode-tab"),
    panels: {
      flash: $("#flashPanel"),
      exam: $("#examPanel"),
      deck: $("#deckPanel"),
    },
    seenCount: $("#seenCount"),
    unseenCount: $("#unseenCount"),
    knownCount: $("#knownCount"),
    unknownCount: $("#unknownCount"),
    flashCounter: $("#flashCounter"),
    flashGroup: $("#flashGroup"),
    flashImage: $("#flashImage"),
    answerCard: $("#answerCard"),
    answerText: $("#answerText"),
    answerSubtext: $("#answerSubtext"),
    prevFlashBtn: $("#prevFlashBtn"),
    unknownFlashBtn: $("#unknownFlashBtn"),
    knownFlashBtn: $("#knownFlashBtn"),
    nextFlashBtn: $("#nextFlashBtn"),
    examSetCount: $("#examSetCount"),
    examOnTimeCount: $("#examOnTimeCount"),
    examAverageTime: $("#examAverageTime"),
    examRepeatCount: $("#examRepeatCount"),
    examMessage: $("#examMessage"),
    timerFill: $("#timerFill"),
    timerText: $("#timerText"),
    startExamBtn: $("#startExamBtn"),
    revealExamBtn: $("#revealExamBtn"),
    examModeButtons: $$("[data-exam-source]"),
    examGrid: $("#examGrid"),
    deckSearch: $("#deckSearch"),
    deckList: $("#deckList"),
  };

  const state = loadState();
  const runtime = {
    mode: "flash",
    flashQueue: [],
    flashIndex: 0,
    flashItem: null,
    flashRevealed: false,
    examItems: [],
    examStartedAt: 0,
    examElapsed: 0,
    examTimer: null,
    examRevealed: false,
    examSourceMode: "weak",
    resetArmed: false,
    resetTimer: null,
  };

  function freshState() {
    return {
      version: 4,
      items: {},
      exam: {
        sets: 0,
        onTimeSets: 0,
        overSets: 0,
        totalElapsed: 0,
        lastElapsed: 0,
        repeatItems: {},
        sourceMode: "weak",
      },
      savedAt: Date.now(),
    };
  }

  function loadState() {
    const fallback = freshState();
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (!parsed || typeof parsed !== "object") return fallback;
      if (parsed.version === 4) {
        return {
          ...fallback,
          ...parsed,
          items: parsed.items || {},
          exam: { ...fallback.exam, ...(parsed.exam || {}), repeatItems: (parsed.exam && parsed.exam.repeatItems) || {} },
        };
      }
      return migrateState(parsed, fallback);
    } catch (_error) {
      return fallback;
    }
  }

  function migrateState(oldState, fallback) {
    const migrated = fallback;
    const oldItems = oldState.items || {};
    const cramItems = (oldState.cram && oldState.cram.items) || {};
    const flashItems = (oldState.flash && oldState.flash.items) || oldItems;
    HERBS.forEach((item) => {
      const id = item.id;
      const c = cramItems[id] || {};
      const f = flashItems[id] || {};
      const seen = Boolean(c.seen || f.seen || f.attempts);
      const status = c.pass || f.status === "known" ? "known" : c.weak || f.status === "weak" ? "unknown" : "new";
      if (seen || status !== "new") {
        migrated.items[id] = {
          seen,
          status,
          seenCount: Number(c.seen || f.seen || f.attempts || 0),
          lastSeen: c.lastSeen || f.lastSeen || 0,
        };
      }
    });
    if (oldState.exam) {
      migrated.exam.sets = oldState.exam.sets || 0;
      migrated.exam.onTimeSets = oldState.exam.onTimeSets || 0;
      migrated.exam.overSets = oldState.exam.overSets || 0;
      migrated.exam.totalElapsed = oldState.exam.totalElapsed || 0;
      migrated.exam.lastElapsed = oldState.exam.lastElapsed || 0;
      const repeatItems = {};
      const oldExamItems = oldState.exam.items || {};
      Object.keys(oldExamItems).forEach((id) => {
        if (oldExamItems[id].repeat || oldExamItems[id].slow) repeatItems[id] = true;
      });
      migrated.exam.repeatItems = repeatItems;
    }
    return migrated;
  }

  function saveState(label) {
    state.savedAt = Date.now();
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    if (label) {
      els.saveStatus.textContent = label;
      setTimeout(() => {
        els.saveStatus.textContent = "자동 저장됨";
      }, 1600);
    }
  }

  function itemState(id) {
    if (!state.items[id]) {
      state.items[id] = {
        seen: false,
        status: "new",
        seenCount: 0,
        lastSeen: 0,
      };
    }
    return state.items[id];
  }

  function markSeen(item) {
    const s = itemState(item.id);
    if (!s.seen) {
      s.seen = true;
      s.status = s.status === "new" ? "unknown" : s.status;
    }
    s.seenCount += 1;
    s.lastSeen = Date.now();
    saveState();
  }

  function normalize(value) {
    return String(value || "")
      .replace(/[()\[\]{}]/g, "")
      .replace(/\s+/g, "")
      .replace(/[·ㆍ.,/\\-]/g, "")
      .toLowerCase();
  }

  function shuffle(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function weightedPick(pool) {
    const weighted = pool.map((item) => {
      const s = itemState(item.id);
      let weight = 10;
      if (!s.seen) weight += 8;
      if (s.status === "unknown") weight += 18;
      if (s.status === "known") weight -= 5;
      if (state.exam.repeatItems[item.id]) weight += 12;
      return { item, weight: Math.max(1, weight) };
    });
    const totalWeight = weighted.reduce((sum, row) => sum + row.weight, 0);
    let ticket = Math.random() * totalWeight;
    for (const row of weighted) {
      ticket -= row.weight;
      if (ticket <= 0) return row.item;
    }
    return weighted[weighted.length - 1].item;
  }

  function renderStats() {
    let seen = 0;
    let known = 0;
    let unknown = 0;
    HERBS.forEach((item) => {
      const s = itemState(item.id);
      if (s.seen) seen += 1;
      if (s.status === "known") known += 1;
      if (s.seen && s.status !== "known") unknown += 1;
    });
    els.seenCount.textContent = seen;
    els.unseenCount.textContent = Math.max(0, TOTAL - seen);
    els.knownCount.textContent = known;
    els.unknownCount.textContent = unknown;
    renderExamStats();
  }

  function renderExamStats() {
    const sets = state.exam.sets || 0;
    const average = sets ? Math.round((state.exam.totalElapsed || 0) / sets) : 0;
    const repeatCount = Object.values(state.exam.repeatItems || {}).filter(Boolean).length;
    els.examSetCount.textContent = sets;
    els.examOnTimeCount.textContent = state.exam.onTimeSets || 0;
    els.examAverageTime.textContent = `${average}초`;
    els.examRepeatCount.textContent = repeatCount;
  }

  function setMode(mode) {
    runtime.mode = mode;
    els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.mode === mode));
    Object.entries(els.panels).forEach(([key, panel]) => panel.classList.toggle("active", key === mode));
    if (mode === "deck") renderDeck();
  }

  function setExamSourceMode(mode, options = {}) {
    const validModes = new Set(["weak", "real", "exclude-known"]);
    runtime.examSourceMode = validModes.has(mode) ? mode : "weak";
    state.exam.sourceMode = runtime.examSourceMode;
    els.examModeButtons.forEach((button) => {
      const active = button.dataset.examSource === runtime.examSourceMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    if (!options.skipSave) saveState();
  }

  function examSourceLabel() {
    if (runtime.examSourceMode === "real") return "실전혼합";
    if (runtime.examSourceMode === "exclude-known") return "완료제외";
    return "약점압축";
  }

  function buildFlashQueue() {
    const incomplete = HERBS.filter((item) => itemState(item.id).status !== "known");
    runtime.flashQueue = shuffle(incomplete.length ? incomplete : HERBS);
    runtime.flashIndex = 0;
    renderFlash();
  }

  function currentFlashItem() {
    if (!runtime.flashQueue.length) buildFlashQueue();
    return runtime.flashQueue[runtime.flashIndex % runtime.flashQueue.length];
  }

  function renderFlash() {
    const item = currentFlashItem();
    runtime.flashItem = item;
    runtime.flashRevealed = false;
    els.flashCounter.textContent = `${runtime.flashIndex + 1} / ${runtime.flashQueue.length}`;
    els.flashGroup.textContent = item.groupTitle.replace(/^[A-Z]그룹:\s*/, "");
    els.flashImage.src = item.image;
    els.flashImage.alt = item.name;
    els.answerCard.classList.remove("revealed");
    els.answerText.textContent = "탭하여 정답 보기";
    els.answerSubtext.textContent = "";
  }

  function revealFlash() {
    if (!runtime.flashItem || runtime.flashRevealed) return;
    runtime.flashRevealed = true;
    markSeen(runtime.flashItem);
    els.answerCard.classList.add("revealed");
    els.answerText.textContent = runtime.flashItem.name;
    els.answerSubtext.textContent = runtime.flashItem.tip;
    renderStats();
  }

  function gradeFlash(status) {
    if (!runtime.flashItem) return;
    if (!runtime.flashRevealed) revealFlash();
    const item = runtime.flashItem;
    const s = itemState(item.id);
    s.status = status;
    s.seen = true;
    s.lastSeen = Date.now();
    saveState("저장됨");
    renderStats();

    const current = item;
    runtime.flashQueue.splice(runtime.flashIndex, 1);
    if (status === "unknown") {
      const insertAt = Math.min(runtime.flashIndex + 2, runtime.flashQueue.length);
      runtime.flashQueue.splice(insertAt, 0, current);
    }
    if (!runtime.flashQueue.length) buildFlashQueue();
    else {
      runtime.flashIndex = Math.min(runtime.flashIndex, runtime.flashQueue.length - 1);
      renderFlash();
    }
  }

  function moveFlash(delta) {
    if (!runtime.flashQueue.length) return;
    runtime.flashIndex = (runtime.flashIndex + delta + runtime.flashQueue.length) % runtime.flashQueue.length;
    renderFlash();
  }

  function startExam() {
    clearExamTimer();
    runtime.examItems = pickExamItems();
    runtime.examElapsed = 0;
    runtime.examStartedAt = Date.now();
    runtime.examRevealed = false;
    els.examMessage.textContent = `${examSourceLabel()} · 종이에 한자명을 쓰고, 끝나면 정답보기를 누르세요.`;
    renderExamGrid(false);
    renderTimer();
    runtime.examTimer = setInterval(tickExam, 250);
  }

  function examModePool() {
    if (runtime.examSourceMode === "real") return HERBS;
    const pool = HERBS.filter((item) => {
      const s = itemState(item.id);
      const repeated = Boolean(state.exam.repeatItems[item.id]);
      if (runtime.examSourceMode === "exclude-known") return s.status !== "known";
      return s.status !== "known" || repeated;
    });
    return pool.length ? pool : HERBS;
  }

  function pickExamItems() {
    const chosen = [];
    const used = new Set();
    const primaryPool = examModePool();
    while (chosen.length < 4 && used.size < HERBS.length) {
      const primaryCandidates = primaryPool.filter((item) => !used.has(item.id));
      const candidates = primaryCandidates.length ? primaryCandidates : HERBS.filter((item) => !used.has(item.id));
      const item = weightedPick(candidates);
      chosen.push(item);
      used.add(item.id);
    }
    return chosen;
  }

  function renderExamGrid(showAnswers) {
    els.examGrid.innerHTML = "";
    runtime.examItems.forEach((item, index) => {
      const repeated = Boolean(state.exam.repeatItems[item.id]);
      const card = document.createElement("article");
      card.className = `exam-card ${showAnswers ? "revealed" : ""} ${repeated ? "repeat" : ""}`;
      card.dataset.id = item.id;
      card.innerHTML = `
        <img src="${item.image}" alt="${item.name}">
        <div class="exam-index">${index + 1}</div>
        ${
          showAnswers
            ? `<div class="exam-answer">
                <strong>${escapeHtml(item.name)}</strong>
                <p>${escapeHtml(item.tip)}</p>
                <div class="mini-actions">
                  <button type="button" data-exam-grade="unknown" data-id="${item.id}">미완료</button>
                  <button type="button" data-exam-grade="known" data-id="${item.id}">완료</button>
                </div>
              </div>`
            : '<p class="exam-prompt">한자명 작성</p>'
        }
      `;
      els.examGrid.appendChild(card);
    });
  }

  function tickExam() {
    runtime.examElapsed = Math.floor((Date.now() - runtime.examStartedAt) / 1000);
    renderTimer();
    if (runtime.examElapsed > 60 && !runtime.examRevealed) {
      els.examMessage.textContent = `시간 초과 +${runtime.examElapsed - 60}초 · 계속 풀고 정답보기`;
    }
  }

  function renderTimer() {
    const elapsed = runtime.examElapsed || 0;
    const text = elapsed > 60 ? `+${elapsed - 60}` : String(60 - elapsed);
    els.timerText.textContent = runtime.examItems.length ? text : "60";
    const ratio = elapsed <= 60 ? Math.max(0, (60 - elapsed) / 60) : Math.min(1, (elapsed - 60) / 60);
    els.timerFill.style.width = `${ratio * 100}%`;
    els.timerFill.style.background = elapsed > 60 ? "var(--danger)" : "var(--accent)";
  }

  function revealExam() {
    if (!runtime.examItems.length || runtime.examRevealed) return;
    clearExamTimer();
    runtime.examElapsed = Math.max(1, Math.floor((Date.now() - runtime.examStartedAt) / 1000));
    runtime.examRevealed = true;
    const over = Math.max(0, runtime.examElapsed - 60);
    state.exam.sets += 1;
    state.exam.totalElapsed += runtime.examElapsed;
    state.exam.lastElapsed = runtime.examElapsed;
    if (over) state.exam.overSets += 1;
    else state.exam.onTimeSets += 1;

    runtime.examItems.forEach((item) => {
      markSeen(item);
      const s = itemState(item.id);
      s.seen = true;
      s.status = "known";
      s.lastSeen = Date.now();
      delete state.exam.repeatItems[item.id];
    });

    saveState("기본 완료 저장");
    renderExamGrid(true);
    renderStats();
    renderTimer();
    els.examMessage.textContent = over
      ? `+${over}초 초과 · 기본은 완료, 틀리거나 느린 약재만 미완료`
      : `${runtime.examElapsed}초 완료 · 기본은 완료, 틀린 약재만 미완료`;
  }

  function clearExamTimer() {
    if (runtime.examTimer) clearInterval(runtime.examTimer);
    runtime.examTimer = null;
  }

  function gradeExamItem(id, status) {
    const item = HERBS.find((row) => String(row.id) === String(id));
    if (!item) return;
    const s = itemState(item.id);
    s.seen = true;
    s.status = status;
    s.lastSeen = Date.now();
    if (status === "unknown") state.exam.repeatItems[item.id] = true;
    if (status === "known") delete state.exam.repeatItems[item.id];
    saveState("저장됨");
    renderStats();
    renderExamGrid(true);
  }

  function renderDeck() {
    const query = normalize(els.deckSearch.value);
    const items = HERBS.filter((item) => {
      if (!query) return true;
      return (
        normalize(item.name).includes(query) ||
        normalize(item.hanja).includes(query) ||
        normalize(item.hangul).includes(query) ||
        normalize(item.groupTitle).includes(query)
      );
    });
    els.deckList.innerHTML = "";
    items.forEach((item) => {
      const s = itemState(item.id);
      const row = document.createElement("button");
      row.className = "deck-row";
      row.type = "button";
      row.innerHTML = `
        <img src="${item.image}" alt="${item.name}">
        <span>
          <strong>${String(item.id).padStart(3, "0")}. ${escapeHtml(item.name)}</strong>
          <small>${statusLabel(s)} · ${escapeHtml(item.groupTitle)}</small>
        </span>
      `;
      row.addEventListener("click", () => {
        runtime.flashQueue = [item, ...shuffle(HERBS.filter((candidate) => candidate.id !== item.id))];
        runtime.flashIndex = 0;
        setMode("flash");
        renderFlash();
      });
      els.deckList.appendChild(row);
    });
  }

  function statusLabel(s) {
    if (!s.seen) return "안 봄";
    if (s.status === "known") return "암기완료";
    return "암기미완료";
  }

  function exportData() {
    const payload = {
      app: "본초 감별",
      exportedAt: new Date().toISOString(),
      state,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "boncho-progress.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    els.saveStatus.textContent = "백업 파일 저장";
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        const imported = parsed.state || parsed;
        const migrated = imported.version === 4 ? imported : migrateState(imported, freshState());
        state.version = 4;
        state.items = migrated.items || {};
        state.exam = { ...freshState().exam, ...(migrated.exam || {}) };
        saveState("불러오기 완료");
        renderStats();
        buildFlashQueue();
        renderDeck();
      } catch (_error) {
        els.saveStatus.textContent = "불러오기 실패";
      }
    };
    reader.readAsText(file);
  }

  function resetData() {
    if (!runtime.resetArmed) {
      runtime.resetArmed = true;
      els.resetBtn.textContent = "한 번 더";
      if (runtime.resetTimer) clearTimeout(runtime.resetTimer);
      runtime.resetTimer = setTimeout(() => {
        runtime.resetArmed = false;
        els.resetBtn.textContent = "초기화";
      }, 2500);
      return;
    }
    const clean = freshState();
    state.version = clean.version;
    state.items = clean.items;
    state.exam = clean.exam;
    saveState("초기화됨");
    runtime.resetArmed = false;
    els.resetBtn.textContent = "초기화";
    clearExamTimer();
    runtime.examItems = [];
    runtime.examRevealed = false;
    els.examGrid.innerHTML = "";
    els.examMessage.textContent = "시작을 누르면 4개 약재가 나옵니다.";
    runtime.examElapsed = 0;
    renderTimer();
    renderStats();
    buildFlashQueue();
    renderDeck();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function bindEvents() {
    els.tabs.forEach((tab) => tab.addEventListener("click", () => setMode(tab.dataset.mode)));
    els.examModeButtons.forEach((button) =>
      button.addEventListener("click", () => setExamSourceMode(button.dataset.examSource)),
    );
    els.answerCard.addEventListener("click", revealFlash);
    els.flashImage.addEventListener("click", revealFlash);
    els.prevFlashBtn.addEventListener("click", () => moveFlash(-1));
    els.nextFlashBtn.addEventListener("click", () => moveFlash(1));
    els.unknownFlashBtn.addEventListener("click", () => gradeFlash("unknown"));
    els.knownFlashBtn.addEventListener("click", () => gradeFlash("known"));
    els.startExamBtn.addEventListener("click", startExam);
    els.revealExamBtn.addEventListener("click", revealExam);
    els.examGrid.addEventListener("click", (event) => {
      const button = event.target.closest("[data-exam-grade]");
      if (button) {
        gradeExamItem(button.dataset.id, button.dataset.examGrade);
      }
    });
    els.deckSearch.addEventListener("input", renderDeck);
    els.exportBtn.addEventListener("click", exportData);
    els.importBtn.addEventListener("click", () => els.importFile.click());
    els.importFile.addEventListener("change", () => {
      const file = els.importFile.files && els.importFile.files[0];
      if (file) importData(file);
      els.importFile.value = "";
    });
    els.resetBtn.addEventListener("click", resetData);
  }

  function init() {
    if (!HERBS.length) {
      document.body.innerHTML = "<p>데이터를 불러오지 못했습니다.</p>";
      return;
    }
    bindEvents();
    setExamSourceMode(state.exam.sourceMode || "weak", { skipSave: true });
    renderStats();
    renderTimer();
    buildFlashQueue();
    renderDeck();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  init();
})();

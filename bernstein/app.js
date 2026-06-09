const state = {
  handoff: null,
  records: [],
  filters: {
    search: "",
    path: "",
    tag: "",
    source: "",
    startOnly: false,
    nscOnly: false
  }
};

const els = {
  coreRecords: document.querySelector("#coreRecords"),
  corePages: document.querySelector("#corePages"),
  startHereCount: document.querySelector("#startHereCount"),
  withheldCount: document.querySelector("#withheldCount"),
  profileRows: document.querySelector("#profileRows"),
  questionList: document.querySelector("#questionList"),
  startRows: document.querySelector("#startRows"),
  recordRows: document.querySelector("#recordRows"),
  gapRows: document.querySelector("#gapRows"),
  filteredCount: document.querySelector("#filteredCount"),
  search: document.querySelector("#searchInput"),
  path: document.querySelector("#pathFilter"),
  tag: document.querySelector("#tagFilter"),
  source: document.querySelector("#sourceFilter"),
  startOnly: document.querySelector("#startOnly"),
  nscOnly: document.querySelector("#nscOnly")
};

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function recordHref(record) {
  return record.sourceUrl || record.pdfUrl || "";
}

function pageSpan(record) {
  return `${record.versionPageStart}-${record.versionPageEnd}`;
}

function sourceById(sourceId) {
  return (state.handoff?.profileSources || []).find((source) => source.id === sourceId);
}

function pathRecordIds(pathId) {
  const readingPath = (state.handoff?.readingPaths || []).find((path) => path.id === pathId);
  return new Set((readingPath?.records || []).map((record) => record.id));
}

function compareRecords(a, b) {
  return Number(b.bernstein?.score || 0) - Number(a.bernstein?.score || 0) ||
    Number(a.versionOrder || 0) - Number(b.versionOrder || 0);
}

function matchesSearch(record, term) {
  if (!term) return true;
  const haystack = [
    record.title,
    record.documentType,
    record.sourceClass,
    record.sourceNote,
    record.version2?.lane,
    record.bernstein?.note,
    record.bernstein?.question,
    ...(record.bernstein?.tagLabels || []),
    ...(record.priorityReasons || []),
    ...(record.topics || []),
    ...(record.people || []),
    ...(record.countries || [])
  ].join(" ").toLowerCase();
  return haystack.includes(term);
}

function filteredRecords() {
  const term = state.filters.search.trim().toLowerCase();
  const activePathIds = state.filters.path ? pathRecordIds(state.filters.path) : null;
  return state.records
    .filter((record) => !activePathIds || activePathIds.has(record.id))
    .filter((record) => !state.filters.tag || record.bernstein?.tags?.includes(state.filters.tag))
    .filter((record) => !state.filters.source || record.sourceClass === state.filters.source)
    .filter((record) => !state.filters.startOnly || record.bernstein?.isStartHere)
    .filter((record) => !state.filters.nscOnly || record.nscSoc?.isNscRecord || record.nscSoc?.isSummaryOfConclusions)
    .filter((record) => matchesSearch(record, term))
    .sort(compareRecords);
}

function renderMetrics() {
  const metrics = state.handoff?.metrics || {};
  els.coreRecords.textContent = formatNumber(metrics.records);
  els.corePages.textContent = formatNumber(metrics.pages);
  els.startHereCount.textContent = formatNumber(metrics.startHereRecords);
  els.withheldCount.textContent = formatNumber(metrics.withheldMeetingControls);
}

function renderProfileRows() {
  els.profileRows.replaceChildren();
  for (const signal of state.handoff?.profileSignals || []) {
    const source = sourceById(signal.sourceId);
    const sourceLink = source
      ? `<a href="${escapeAttribute(source.url)}">${escapeHtml(source.label)}</a>`
      : escapeHtml(signal.sourceId);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(signal.signal)}</td>
      <td>${escapeHtml(signal.handoffImplication)}</td>
      <td>${sourceLink}</td>
    `;
    els.profileRows.append(tr);
  }
}

function renderQuestions() {
  els.questionList.replaceChildren();
  for (const question of state.handoff?.researchQuestions || []) {
    const li = document.createElement("li");
    li.textContent = question;
    els.questionList.append(li);
  }
}

function renderOptions() {
  for (const readingPath of state.handoff?.readingPaths || []) {
    const option = document.createElement("option");
    option.value = readingPath.id;
    option.textContent = readingPath.title;
    els.path.append(option);
  }

  for (const tag of state.handoff?.tagDefinitions || []) {
    const option = document.createElement("option");
    option.value = tag.id;
    option.textContent = tag.label;
    els.tag.append(option);
  }

  for (const source of [...new Set(state.records.map((record) => record.sourceClass).filter(Boolean))].sort()) {
    const option = document.createElement("option");
    option.value = source;
    option.textContent = source;
    els.source.append(option);
  }
}

function tagsMarkup(record) {
  return (record.bernstein?.tagLabels || [])
    .map((label) => `<span class="tag">${escapeHtml(label)}</span>`)
    .join("");
}

function titleMarkup(record) {
  const href = recordHref(record);
  const title = href
    ? `<a class="record-title" href="${escapeAttribute(href)}">${escapeHtml(record.title)}</a>`
    : `<span class="record-title">${escapeHtml(record.title)}</span>`;
  return `${title}<span class="record-meta">${escapeHtml(record.bernstein?.note || "")}</span>`;
}

function renderStartRows() {
  els.startRows.replaceChildren();
  for (const [index, record] of (state.handoff?.startHere || []).entries()) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${escapeHtml(record.date)}</td>
      <td>${escapeHtml(record.version2?.lane || "")}</td>
      <td>${titleMarkup(record)}</td>
      <td><span class="tag-list">${tagsMarkup(record)}</span></td>
      <td>${escapeHtml(pageSpan(record))}</td>
    `;
    els.startRows.append(tr);
  }
}

function renderRecordRows() {
  const rows = filteredRecords();
  els.recordRows.replaceChildren();
  els.filteredCount.textContent = `${formatNumber(rows.length)} records`;

  if (!rows.length) {
    els.recordRows.innerHTML = `<tr><td colspan="7">No records match the current filters.</td></tr>`;
    return;
  }

  for (const record of rows) {
    const sourcePages = record.sourcePages ? `source ${record.sourcePages}` : "";
    const pages = [pageSpan(record), sourcePages].filter(Boolean).join("; ");
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="score">${escapeHtml(record.bernstein?.score || 0)}</span></td>
      <td>${escapeHtml(record.date || "")}</td>
      <td>${escapeHtml(record.version2?.lane || "")}</td>
      <td>${titleMarkup(record)}</td>
      <td><span class="tag-list">${tagsMarkup(record)}</span></td>
      <td>${escapeHtml(record.sourceClass || "")}</td>
      <td>${escapeHtml(pages)}</td>
    `;
    els.recordRows.append(tr);
  }
}

function renderGapRows() {
  els.gapRows.replaceChildren();
  for (const control of state.handoff?.withheldMeetingControls || []) {
    const href = recordHref(control);
    const title = href
      ? `<a class="record-title" href="${escapeAttribute(href)}">${escapeHtml(control.title)}</a>`
      : `<span class="record-title">${escapeHtml(control.title)}</span>`;
    const status = [control.releaseStatus, control.restriction].filter(Boolean).join(" / ");
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(control.date || "")}</td>
      <td>${escapeHtml(control.committee || "")}</td>
      <td>${title}<span class="record-meta">${escapeHtml(control.bernsteinReason || "")}</span></td>
      <td>${escapeHtml(control.packetIdentifier || "")}</td>
      <td>${escapeHtml(status)}</td>
      <td>${escapeHtml(control.withdrawalSheetPages || "")}</td>
    `;
    els.gapRows.append(tr);
  }
}

function render() {
  renderMetrics();
  renderProfileRows();
  renderQuestions();
  renderStartRows();
  renderRecordRows();
  renderGapRows();
}

function bindFilters() {
  els.search.addEventListener("input", (event) => {
    state.filters.search = event.target.value;
    renderRecordRows();
  });

  els.path.addEventListener("change", (event) => {
    state.filters.path = event.target.value;
    renderRecordRows();
  });

  els.tag.addEventListener("change", (event) => {
    state.filters.tag = event.target.value;
    renderRecordRows();
  });

  els.source.addEventListener("change", (event) => {
    state.filters.source = event.target.value;
    renderRecordRows();
  });

  els.startOnly.addEventListener("change", (event) => {
    state.filters.startOnly = event.target.checked;
    renderRecordRows();
  });

  els.nscOnly.addEventListener("change", (event) => {
    state.filters.nscOnly = event.target.checked;
    renderRecordRows();
  });
}

async function init() {
  const response = await fetch("../data/bernstein-handoff.json");
  state.handoff = await response.json();
  state.records = state.handoff.records || [];
  renderOptions();
  bindFilters();
  render();
}

init().catch((error) => {
  els.recordRows.innerHTML = `<tr><td colspan="7">Unable to load Bernstein handoff: ${escapeHtml(error.message)}</td></tr>`;
});

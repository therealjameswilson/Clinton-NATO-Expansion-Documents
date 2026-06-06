const state = {
  manifest: null,
  records: [],
  filters: {
    search: "",
    lane: "",
    source: "",
    nscOnly: false
  }
};

const els = {
  recordCount: document.querySelector("#recordCount"),
  pageCount: document.querySelector("#pageCount"),
  nscCount: document.querySelector("#nscCount"),
  reviewCount: document.querySelector("#reviewCount"),
  rows: document.querySelector("#recordRows"),
  search: document.querySelector("#searchInput"),
  lane: document.querySelector("#laneFilter"),
  source: document.querySelector("#sourceFilter"),
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

function displayDate(record) {
  return record.date || "";
}

function compareRecords(a, b) {
  return Number(a.versionOrder || 0) - Number(b.versionOrder || 0);
}

function filteredRecords() {
  const term = state.filters.search.trim().toLowerCase();
  return state.records
    .filter((record) => !state.filters.lane || record.version2?.lane === state.filters.lane)
    .filter((record) => !state.filters.source || record.sourceClass === state.filters.source)
    .filter((record) => !state.filters.nscOnly || record.nscSoc?.isNscRecord || record.nscSoc?.isSummaryOfConclusions)
    .filter((record) => {
      if (!term) return true;
      const haystack = [
        record.title,
        record.documentType,
        record.sourceClass,
        record.sourceNote,
        record.version2?.lane,
        ...(record.version2?.matches || []),
        ...(record.priorityReasons || []),
        ...(record.topics || []),
        ...(record.people || []),
        ...(record.countries || [])
      ].join(" ").toLowerCase();
      return haystack.includes(term);
    })
    .sort(compareRecords);
}

function renderMetrics() {
  els.recordCount.textContent = formatNumber(state.manifest?.selectedCount || state.records.length);
  els.pageCount.textContent = formatNumber(state.manifest?.selectedPageTotal || 0);
  els.nscCount.textContent = formatNumber(state.manifest?.nscSocCount || 0);
  els.reviewCount.textContent = formatNumber(state.manifest?.reviewCandidateCount || 0);
}

function renderSelectOptions(selectEl, values) {
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    selectEl.append(option);
  }
}

function renderFilterOptions() {
  renderSelectOptions(els.lane, [...new Set(state.records.map((record) => record.version2?.lane).filter(Boolean))].sort());
  renderSelectOptions(els.source, [...new Set(state.records.map((record) => record.sourceClass).filter(Boolean))].sort());
}

function renderRows() {
  const rows = filteredRecords();
  els.rows.replaceChildren();

  for (const record of rows) {
    const tr = document.createElement("tr");
    const href = record.sourceUrl || record.pdfUrl || "";
    const title = href
      ? `<a class="record-title" href="${escapeHtml(href)}">${escapeHtml(record.title)}</a>`
      : `<span class="record-title">${escapeHtml(record.title)}</span>`;
    const sourcePages = record.sourcePages ? `source ${record.sourcePages}` : "";
    const versionPages = `${record.versionPageStart}-${record.versionPageEnd}`;
    const pageMeta = [versionPages, sourcePages].filter(Boolean).join("; ");

    tr.innerHTML = `
      <td>${escapeHtml(record.versionOrder)}</td>
      <td>${escapeHtml(displayDate(record))}</td>
      <td>${escapeHtml(record.version2?.lane || "")}</td>
      <td>${title}<span class="record-meta">${escapeHtml(record.version2?.rationale || "")}</span></td>
      <td>${escapeHtml(record.documentType || "")}</td>
      <td>${escapeHtml(record.sourceClass || "")}</td>
      <td>${escapeHtml(pageMeta)}</td>
      <td>${escapeHtml((record.version2?.matches || []).join("; "))}</td>
    `;
    els.rows.append(tr);
  }
}

function render() {
  renderMetrics();
  renderRows();
}

function bindFilters() {
  els.search.addEventListener("input", (event) => {
    state.filters.search = event.target.value;
    renderRows();
  });

  els.lane.addEventListener("change", (event) => {
    state.filters.lane = event.target.value;
    renderRows();
  });

  els.source.addEventListener("change", (event) => {
    state.filters.source = event.target.value;
    renderRows();
  });

  els.nscOnly.addEventListener("change", (event) => {
    state.filters.nscOnly = event.target.checked;
    renderRows();
  });
}

async function init() {
  const response = await fetch("../data/version-2-explicit-expansion.json");
  state.manifest = await response.json();
  state.records = state.manifest.selected || [];
  renderFilterOptions();
  bindFilters();
  render();
}

init().catch((error) => {
  els.rows.innerHTML = `<tr><td colspan="8">Unable to load version 2.0 dossier: ${escapeHtml(error.message)}</td></tr>`;
});

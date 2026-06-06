const state = {
  records: [],
  filters: {
    search: "",
    priority: "",
    source: "",
    nscOnly: false
  }
};

const els = {
  recordCount: document.querySelector("#recordCount"),
  knownPages: document.querySelector("#knownPages"),
  nscCount: document.querySelector("#nscCount"),
  p0Count: document.querySelector("#p0Count"),
  rows: document.querySelector("#recordRows"),
  search: document.querySelector("#searchInput"),
  priority: document.querySelector("#priorityFilter"),
  source: document.querySelector("#sourceFilter"),
  nscOnly: document.querySelector("#nscOnly")
};

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function displayDate(record) {
  if (!record.date || record.date === "1993-01-01") return "";
  return record.date;
}

function compareRecords(a, b) {
  const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
  const priorityDelta = priorityOrder[a.priority] - priorityOrder[b.priority];
  if (priorityDelta) return priorityDelta;
  const aLead = a.inclusionStatus === "pending-promotion" || a.sourceClass === "nara-scout-lead" || /source lead|scout lead/i.test(a.documentType || "");
  const bLead = b.inclusionStatus === "pending-promotion" || b.sourceClass === "nara-scout-lead" || /source lead|scout lead/i.test(b.documentType || "");
  const leadDelta = Number(aLead) - Number(bLead);
  if (leadDelta) return leadDelta;
  return String(a.date || "9999-99-99").localeCompare(String(b.date || "9999-99-99"));
}

function filteredRecords() {
  const term = state.filters.search.trim().toLowerCase();
  return state.records
    .filter((record) => !state.filters.priority || record.priority === state.filters.priority)
    .filter((record) => !state.filters.source || record.sourceClass === state.filters.source)
    .filter((record) => !state.filters.nscOnly || record.nscSoc?.isNscRecord || record.nscSoc?.isSummaryOfConclusions)
    .filter((record) => {
      if (!term) return true;
      const haystack = [
        record.title,
        record.documentType,
        record.sourceClass,
        record.sourceNote,
        ...(record.topics || []),
        ...(record.people || []),
        ...(record.countries || [])
      ].join(" ").toLowerCase();
      return haystack.includes(term);
    })
    .sort(compareRecords)
    .slice(0, 500);
}

function renderMetrics() {
  const knownPages = state.records.reduce((sum, record) => sum + (Number(record.pageCount) || 0), 0);
  const nscCount = state.records.filter((record) => record.nscSoc?.isNscRecord || record.nscSoc?.isSummaryOfConclusions).length;
  const p0Count = state.records.filter((record) => record.priority === "P0").length;

  els.recordCount.textContent = formatNumber(state.records.length);
  els.knownPages.textContent = formatNumber(knownPages);
  els.nscCount.textContent = formatNumber(nscCount);
  els.p0Count.textContent = formatNumber(p0Count);
}

function renderSourceOptions() {
  const sources = [...new Set(state.records.map((record) => record.sourceClass).filter(Boolean))].sort();
  for (const source of sources) {
    const option = document.createElement("option");
    option.value = source;
    option.textContent = source;
    els.source.append(option);
  }
}

function renderRows() {
  const rows = filteredRecords();
  els.rows.replaceChildren();

  for (const record of rows) {
    const tr = document.createElement("tr");
    const href = record.sourceUrl || record.pdfUrl || "";
    const title = href
      ? `<a class="record-title" href="${href}">${record.title}</a>`
      : `<span class="record-title">${record.title}</span>`;
    const reasons = (record.priorityReasons || []).slice(0, 3).join("; ");

    tr.innerHTML = `
      <td>${displayDate(record)}</td>
      <td><span class="pill ${record.priority.toLowerCase()}">${record.priority}</span></td>
      <td>${title}<span class="record-meta">${reasons}</span></td>
      <td>${record.documentType || ""}</td>
      <td>${record.sourceClass}</td>
      <td>${record.pageCount || ""}</td>
      <td>${record.inclusionStatus}</td>
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

  els.priority.addEventListener("change", (event) => {
    state.filters.priority = event.target.value;
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
  const response = await fetch("data/source-register.json");
  state.records = await response.json();
  renderSourceOptions();
  bindFilters();
  render();
}

init().catch((error) => {
  els.rows.innerHTML = `<tr><td colspan="7">Unable to load register: ${error.message}</td></tr>`;
});

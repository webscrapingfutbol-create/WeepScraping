// ---------- DOM refs ----------
const searchForm = document.getElementById("search-form");
const teamInput = document.getElementById("team-input");
const statusEl = document.getElementById("status");
const searchSpinner = document.getElementById("search-spinner");

const emptyState = document.getElementById("empty-state");
const teamCard = document.getElementById("team-card");
const teamLogoEl = document.getElementById("team-logo");
const teamNameEl = document.getElementById("team-name");
const teamTypeEl = document.getElementById("team-type");
const teamNextDateEl = document.getElementById("team-next-date");
const teamMatchCountEl = document.getElementById("team-match-count");

const teamResult = document.getElementById("team-result");
const liveSection = document.getElementById("live-section");
const liveList = document.getElementById("live-list");

const tabButtons = document.querySelectorAll(".tab-btn");
const tabUpcoming = document.getElementById("tab-upcoming");
const tabRecent = document.getElementById("tab-recent");

const nextMatchHero = document.getElementById("next-match-hero");
const upcomingList = document.getElementById("upcoming-list");

const fOpponent = document.getElementById("f-opponent");
const fCompetition = document.getElementById("f-competition");
const fOdds1Max = document.getElementById("f-odds1-max");
const fOddsXMax = document.getElementById("f-oddsx-max");
const fOdds2Max = document.getElementById("f-odds2-max");
const fDateFrom = document.getElementById("f-date-from");
const fDateTo = document.getElementById("f-date-to");
const fResult = document.getElementById("f-result");
const fSort = document.getElementById("f-sort");
const filtersApply = document.getElementById("filters-apply");
const filtersClear = document.getElementById("filters-clear");

const recentTbody = document.getElementById("recent-tbody");
const paginationSummary = document.getElementById("pagination-summary");
const paginationPages = document.getElementById("pagination-pages");
const pageSizeSelect = document.getElementById("page-size");

const compareModal = document.getElementById("compare-modal");
const modalClose = document.getElementById("modal-close");
const modalLiveIndicator = document.getElementById("modal-live-indicator");
const modalError = document.getElementById("modal-error");
const modalSpinner = document.getElementById("modal-spinner");
const compareTable = document.getElementById("compare-table");
const compareTitle = document.getElementById("compare-title");
const compareBody = document.querySelector("#compare-table tbody");

// ---------- State ----------
let currentTeamName = "";
let overview = null;
const oddsCache = new Map();
let currentPage = 1;
let pageSize = 10;
let recentLoaded = false;

// ---------- Helpers ----------
function teamImageUrl(teamId) {
  return `https://api.sofascore.com/api/v1/team/${teamId}/image`;
}

function formatDate(unixSeconds) {
  if (!unixSeconds) return "-";
  return new Date(unixSeconds * 1000).toLocaleString("es-CO");
}

function formatDateShort(unixSeconds) {
  if (!unixSeconds) return "-";
  return new Date(unixSeconds * 1000).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function arrowHtml(change) {
  if (!change) return "";
  if (change > 0) return `<span class="arrow up">▲</span>`;
  return `<span class="arrow down">▼</span>`;
}

function oddsBadge(label, value, change) {
  const trendClass = change > 0 ? "up" : change < 0 ? "down" : "";
  return `<span class="odds-badge ${trendClass}">${label} ${value} ${arrowHtml(change)}</span>`;
}

function oddsSummaryHtml(match) {
  if (match.oddsHome == null) {
    return `<div class="odds-summary"><span class="odds-badge muted">Sin cuotas</span></div>`;
  }
  return `
    <div class="odds-summary">
      ${oddsBadge("1", match.oddsHome, match.oddsHomeChange)}
      ${oddsBadge("X", match.oddsDraw, match.oddsDrawChange)}
      ${oddsBadge("2", match.oddsAway, match.oddsAwayChange)}
    </div>
  `;
}

async function fetchOddsBatch(eventIds) {
  const missing = eventIds.filter((id) => !oddsCache.has(id));
  if (missing.length === 0) return;
  const res = await fetch("/api/odds-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventIds: missing }),
  });
  const data = await res.json();
  for (const id of missing) {
    oddsCache.set(Number(id), data[id] ?? null);
  }
}

function withCachedOdds(match) {
  const odds = oddsCache.get(match.eventId);
  return odds ? { ...match, ...odds } : match;
}

// ---------- Match cards (en vivo / proximos) ----------
function renderMatchItem(match) {
  const li = document.createElement("li");
  li.innerHTML = `
    <div class="match-info">
      <div>${match.homeTeam} vs ${match.awayTeam}</div>
      <div class="meta">${match.tournament ?? ""} - ${formatDate(match.startTime)} - ${match.status}</div>
    </div>
    ${oddsSummaryHtml(match)}
  `;
  li.addEventListener("click", () => openModal(match.eventId, `${match.homeTeam} vs ${match.awayTeam}`));
  return li;
}

function renderLiveSection(live) {
  liveList.innerHTML = "";
  if (live && live.length > 0) {
    live.forEach((m) => liveList.appendChild(renderMatchItem(m)));
    liveSection.hidden = false;
  } else {
    liveSection.hidden = true;
  }
}

function renderUpcomingList(upcoming) {
  upcomingList.innerHTML = "";
  if (!upcoming || upcoming.length === 0) {
    upcomingList.innerHTML = "<li>Sin mas partidos proximos</li>";
  } else {
    upcoming.forEach((m) => upcomingList.appendChild(renderMatchItem(m)));
  }
}

function renderNextMatchHero(match) {
  if (!match) {
    nextMatchHero.hidden = true;
    return;
  }
  nextMatchHero.hidden = false;
  nextMatchHero.innerHTML = `
    <div class="hero-teams">
      <span><img src="${teamImageUrl(match.homeTeamId)}" alt="" onerror="this.style.visibility='hidden'"> ${match.homeTeam}</span>
    </div>
    <div class="hero-meta">
      <div>${formatDateShort(match.startTime)}</div>
      <div class="muted">${match.tournament ?? ""}</div>
    </div>
    <div class="hero-teams">
      <span>${match.awayTeam} <img src="${teamImageUrl(match.awayTeamId)}" alt="" onerror="this.style.visibility='hidden'"></span>
    </div>
    <div class="hero-odds">
      <div class="hero-odds-cell"><span class="label">1</span><span class="value">${match.oddsHome ?? "-"}</span></div>
      <div class="hero-odds-cell"><span class="label">X</span><span class="value">${match.oddsDraw ?? "-"}</span></div>
      <div class="hero-odds-cell"><span class="label">2</span><span class="value">${match.oddsAway ?? "-"}</span></div>
    </div>
  `;
  nextMatchHero.addEventListener(
    "click",
    () => openModal(match.eventId, `${match.homeTeam} vs ${match.awayTeam}`),
    { once: true }
  );
  nextMatchHero.style.cursor = "pointer";
}

// ---------- Team card ----------
function renderTeamCard(team, nextMatch, recentTotal) {
  emptyState.hidden = true;
  teamCard.hidden = false;
  teamLogoEl.src = teamImageUrl(team.id);
  teamNameEl.textContent = team.name;
  teamTypeEl.textContent = team.national ? "Seleccion nacional" : "Club";
  teamNextDateEl.textContent = nextMatch ? formatDateShort(nextMatch.startTime) : "-";
  teamMatchCountEl.textContent = String(recentTotal);
}

// ---------- Tabs ----------
tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    tabUpcoming.hidden = tab !== "upcoming";
    tabRecent.hidden = tab !== "recent";
    if (tab === "recent" && !recentLoaded) {
      recentLoaded = true;
      applyFiltersAndRender();
    }
  });
});

// ---------- Recent tab: filters, sort, pagination ----------
function populateCompetitionOptions(recent) {
  const tournaments = [...new Set(recent.map((m) => m.tournament).filter(Boolean))].sort();
  fCompetition.innerHTML = '<option value="all">Todas las competiciones</option>';
  for (const t of tournaments) {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    fCompetition.appendChild(opt);
  }
}

function computeResult(match, teamName) {
  if (match.scoreHome == null || match.scoreAway == null) return null;
  const teamScore = match.homeTeam === teamName ? match.scoreHome : match.scoreAway;
  const oppScore = match.homeTeam === teamName ? match.scoreAway : match.scoreHome;
  if (teamScore > oppScore) return "gano";
  if (teamScore < oppScore) return "perdio";
  return "empato";
}

function isOddsFilterActive() {
  return (
    Number(fOdds1Max.value) !== 10 ||
    Number(fOddsXMax.value) !== 10 ||
    Number(fOdds2Max.value) !== 10
  );
}

function baseFilteredRecent() {
  const opponentFilter = fOpponent.value.trim().toLowerCase();
  const competition = fCompetition.value;
  const result = fResult.value;
  const dateFrom = fDateFrom.value ? new Date(fDateFrom.value).getTime() / 1000 : null;
  const dateTo = fDateTo.value ? new Date(fDateTo.value).getTime() / 1000 + 86400 : null;

  return overview.recent.filter((m) => {
    if (opponentFilter) {
      const opponent = (m.homeTeam === currentTeamName ? m.awayTeam : m.homeTeam).toLowerCase();
      if (!opponent.includes(opponentFilter)) return false;
    }
    if (competition !== "all" && m.tournament !== competition) return false;
    if (dateFrom !== null && m.startTime < dateFrom) return false;
    if (dateTo !== null && m.startTime > dateTo) return false;
    if (result !== "all" && computeResult(m, currentTeamName) !== result) return false;
    return true;
  });
}

async function applyFiltersAndRender() {
  if (!overview) return;
  let filtered = baseFilteredRecent();

  if (isOddsFilterActive()) {
    await fetchOddsBatch(filtered.map((m) => m.eventId));
    filtered = filtered.map(withCachedOdds).filter((m) => {
      if (m.oddsHome == null) return false;
      if (m.oddsHome > Number(fOdds1Max.value)) return false;
      if (m.oddsDraw > Number(fOddsXMax.value)) return false;
      if (m.oddsAway > Number(fOdds2Max.value)) return false;
      return true;
    });
  }

  filtered.sort((a, b) => (fSort.value === "date-asc" ? a.startTime - b.startTime : b.startTime - a.startTime));

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  currentPage = Math.min(currentPage, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  await fetchOddsBatch(pageItems.map((m) => m.eventId));
  const pageItemsWithOdds = pageItems.map(withCachedOdds);

  renderRecentTable(pageItemsWithOdds);
  renderPagination(total, totalPages, start, pageItems.length);
}

function renderRecentTable(items) {
  recentTbody.innerHTML = "";
  if (items.length === 0) {
    recentTbody.innerHTML = `<tr><td colspan="7" class="muted">Sin partidos que coincidan con el filtro</td></tr>`;
    return;
  }
  for (const m of items) {
    const homeIsTeam = m.homeTeam === currentTeamName;
    const result = computeResult(m, currentTeamName);
    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";
    tr.innerHTML = `
      <td>${formatDateShort(m.startTime)}</td>
      <td>${m.tournament ?? "-"}</td>
      <td>
        <div class="team-cell"><img src="${teamImageUrl(m.homeTeamId)}" alt="" onerror="this.style.visibility='hidden'">${m.homeTeam}</div>
        <div class="team-cell"><img src="${teamImageUrl(m.awayTeamId)}" alt="" onerror="this.style.visibility='hidden'">${m.awayTeam}</div>
      </td>
      <td class="${homeIsTeam ? "odds-good" : "odds-bad"}">${m.oddsHome ?? "-"}</td>
      <td>${m.oddsDraw ?? "-"}</td>
      <td class="${!homeIsTeam ? "odds-good" : "odds-bad"}">${m.oddsAway ?? "-"}</td>
      <td>
        ${
          result
            ? `<span class="result-badge ${result}">${m.scoreHome}-${m.scoreAway}</span>`
            : "-"
        }
      </td>
    `;
    tr.addEventListener("click", () => openModal(m.eventId, `${m.homeTeam} vs ${m.awayTeam}`));
    recentTbody.appendChild(tr);
  }
}

function renderPagination(total, totalPages, start, pageCount) {
  paginationSummary.textContent =
    total === 0 ? "Sin resultados" : `Mostrando ${start + 1}-${start + pageCount} de ${total} partidos`;

  paginationPages.innerHTML = "";
  for (let p = 1; p <= totalPages; p++) {
    const btn = document.createElement("button");
    btn.textContent = String(p);
    if (p === currentPage) btn.classList.add("active");
    btn.addEventListener("click", () => {
      currentPage = p;
      applyFiltersAndRender();
    });
    paginationPages.appendChild(btn);
  }
}

filtersApply.addEventListener("click", () => {
  currentPage = 1;
  applyFiltersAndRender();
});

filtersClear.addEventListener("click", () => {
  fOpponent.value = "";
  fCompetition.value = "all";
  fOdds1Max.value = "10.00";
  fOddsXMax.value = "10.00";
  fOdds2Max.value = "10.00";
  fDateFrom.value = "";
  fDateTo.value = "";
  fResult.value = "all";
  fSort.value = "date-desc";
  currentPage = 1;
  applyFiltersAndRender();
});

pageSizeSelect.addEventListener("change", () => {
  pageSize = Number(pageSizeSelect.value);
  currentPage = 1;
  applyFiltersAndRender();
});

// ---------- Search ----------
searchForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = teamInput.value.trim();
  if (!q) return;

  statusEl.textContent = "";
  teamResult.hidden = true;
  teamCard.hidden = true;
  searchSpinner.hidden = false;

  try {
    const res = await fetch(`/api/team-overview?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error desconocido");

    if (!data.team) {
      statusEl.textContent = `No se encontro ningun equipo para "${q}".`;
      emptyState.hidden = false;
      return;
    }

    overview = data;
    currentTeamName = data.team.name;
    oddsCache.clear();
    currentPage = 1;
    recentLoaded = false;

    fOpponent.value = "";
    fDateFrom.value = "";
    fDateTo.value = "";
    fResult.value = "all";
    fSort.value = "date-desc";
    fOdds1Max.value = "10.00";
    fOddsXMax.value = "10.00";
    fOdds2Max.value = "10.00";
    populateCompetitionOptions(data.recent);

    renderTeamCard(data.team, data.nextMatch, data.recentTotal);
    renderLiveSection(data.live);
    renderNextMatchHero(data.nextMatch);
    renderUpcomingList(data.upcoming);

    tabButtons.forEach((b) => b.classList.remove("active"));
    document.querySelector('.tab-btn[data-tab="recent"]').classList.add("active");
    tabUpcoming.hidden = true;
    tabRecent.hidden = false;
    recentLoaded = true;
    applyFiltersAndRender();

    teamResult.hidden = false;
  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
    emptyState.hidden = false;
  } finally {
    searchSpinner.hidden = true;
  }
});

// ---------- Modal (detalle en vivo de un partido) ----------
const POLL_MS = 5000;
let currentEventId = null;
let pollTimer = null;
let previousMatch = null;
let isFirstLoad = true;

function nextPollDelay(match) {
  if (match.status === "finished") return null;
  return POLL_MS;
}

const FIELDS = [
  { label: "Equipo local", key: "homeTeam" },
  { label: "Equipo visitante", key: "awayTeam" },
  { label: "Torneo", key: "tournament" },
  { label: "Estado", key: "status" },
  { label: "Marcador local", key: "scoreHome" },
  { label: "Marcador visitante", key: "scoreAway" },
  { label: "Cuota 1", key: "oddsHome", changeKey: "oddsHomeChange" },
  { label: "Cuota X", key: "oddsDraw", changeKey: "oddsDrawChange" },
  { label: "Cuota 2", key: "oddsAway", changeKey: "oddsAwayChange" },
];

function renderMatch(match) {
  compareBody.innerHTML = "";

  for (const field of FIELDS) {
    const value = match[field.key] ?? "-";
    const changedSincePoll =
      previousMatch && String(previousMatch[field.key] ?? "-") !== String(value);
    const arrow = field.changeKey ? arrowHtml(match[field.changeKey]) : "";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${field.label}</td>
      <td class="${changedSincePoll ? "just-changed" : ""}">${value} ${arrow}</td>
    `;
    compareBody.appendChild(tr);
  }

  previousMatch = match;
}

async function refreshMatch() {
  if (!currentEventId) return;
  try {
    const res = await fetch(`/api/match/${currentEventId}`);
    const match = await res.json();
    if (!res.ok) throw new Error(match.error || "Error desconocido");

    modalError.hidden = true;
    renderMatch(match);

    const delay = nextPollDelay(match);
    if (delay === null) {
      stopPolling();
    } else {
      modalLiveIndicator.hidden = false;
      pollTimer = setTimeout(refreshMatch, delay);
    }
  } catch (err) {
    modalError.hidden = false;
    modalError.textContent = `Error: ${err.message}`;
  } finally {
    if (isFirstLoad) {
      modalSpinner.hidden = true;
      compareTable.hidden = false;
      isFirstLoad = false;
    }
  }
}

function stopPolling() {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  modalLiveIndicator.hidden = true;
}

function openModal(eventId, title) {
  currentEventId = eventId;
  previousMatch = null;
  isFirstLoad = true;
  compareTitle.textContent = title;
  compareBody.innerHTML = "";
  modalError.hidden = true;
  compareTable.hidden = true;
  modalSpinner.hidden = false;
  compareModal.hidden = false;

  stopPolling();
  refreshMatch();
}

function closeModal() {
  compareModal.hidden = true;
  stopPolling();
  currentEventId = null;
}

modalClose.addEventListener("click", closeModal);
compareModal.addEventListener("click", (e) => {
  if (e.target === compareModal) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !compareModal.hidden) closeModal();
});

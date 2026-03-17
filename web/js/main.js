import {
  state,
  setParticipants,
  setCohorts,
  setFilter,
  setSelectedKey,
  getParticipantKey,
  applyFilters,
} from "./state.js?v=20260317c";
import { buildIndexes, getZoneRankedRows } from "./analytics.js?v=20260317f";
import { renderList } from "./renderList.js?v=20260317f";
import { renderAthleteDetails } from "./renderAthlete.js?v=20260317f";

const nameSearch = document.querySelector("#nameSearch");
const bibSearch = document.querySelector("#bibSearch");
const eventFilter = document.querySelector("#eventFilter");
const listCountEl = document.querySelector("#listCount");
const bodyEl = document.querySelector("#resultsBody");
const detailsContent = document.querySelector("#detailsContent");
const summaryText = document.querySelector("#summaryText");
const zoneCategoryFilter = document.querySelector("#zoneCategoryFilter");
const zoneFilter = document.querySelector("#zoneFilter");
const zoneRankingCount = document.querySelector("#zoneRankingCount");
const zoneRankingBody = document.querySelector("#zoneRankingBody");
const searchBtn = document.querySelector("#searchBtn");

let indexes = { byEvent: {}, zoneTimesByEvent: {} };
const participantByKey = new Map();

function zoneSortValue(zoneName) {
  const match = String(zoneName).match(/\d+/);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

function formatZoneSeconds(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return "-";
  const whole = Math.round(seconds);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getSelectedAthlete() {
  if (!state.selectedKey) return null;
  return state.participants.find((athlete) => getParticipantKey(athlete) === state.selectedKey) || null;
}

function refreshUI() {
  const rows = applyFilters();
  const selectedAthlete = getSelectedAthlete();
  renderList({
    rows,
    selectedKey: state.selectedKey,
    onSelect: (key) => {
      setSelectedKey(key);
      refreshUI();
    },
    listCountEl,
    bodyEl,
  });
  renderAthleteDetails({ athlete: selectedAthlete, indexes, container: detailsContent });
  renderZoneLeaderboard();
}

function fillZoneCategoryDropdown() {
  zoneCategoryFilter.innerHTML = "";
  const events = Object.keys(indexes.zoneTimesByEvent).sort();
  for (const event of events) {
    const option = document.createElement("option");
    option.value = event;
    option.textContent = event;
    zoneCategoryFilter.appendChild(option);
  }
}

function fillZoneDropdown(eventName) {
  zoneFilter.innerHTML = "";
  const zones = Object.keys(indexes.zoneTimesByEvent[eventName] || {}).sort(
    (a, b) => zoneSortValue(a) - zoneSortValue(b)
  );
  for (const zoneName of zones) {
    const option = document.createElement("option");
    option.value = zoneName;
    option.textContent = zoneName;
    zoneFilter.appendChild(option);
  }
}

function renderZoneLeaderboard() {
  const selectedCategory = zoneCategoryFilter.value;
  const selectedZone = zoneFilter.value;
  zoneRankingBody.innerHTML = "";

  if (!selectedCategory || !selectedZone) {
    zoneRankingCount.textContent = "Select category and zone to view ranking.";
    return;
  }

  const rows = getZoneRankedRows(selectedCategory, selectedZone, indexes);
  zoneRankingCount.textContent = `${rows.length} athlete(s) ranked in ${selectedZone} for ${selectedCategory}`;

  for (let i = 0; i < rows.length; i += 1) {
    const athlete = participantByKey.get(rows[i].athleteKey.toLowerCase());
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${rows[i].rank ?? "-"}</td>
      <td>${athlete?.name ?? "-"}</td>
      <td>${athlete?.bibNo ?? "-"}</td>
      <td>${formatZoneSeconds(rows[i].seconds)}</td>
    `;
    zoneRankingBody.appendChild(tr);
  }
}

function fillEventDropdown() {
  const events = Array.from(new Set(state.participants.map((p) => p.event))).sort();
  for (const event of events) {
    const option = document.createElement("option");
    option.value = event;
    option.textContent = event;
    eventFilter.appendChild(option);
  }
}

function runSearchFilters() {
  setFilter({
    name: nameSearch.value,
    bib: bibSearch.value,
    event: eventFilter.value,
  });
  if (eventFilter.value !== "ALL") {
    zoneCategoryFilter.value = eventFilter.value;
    fillZoneDropdown(eventFilter.value);
  }
  refreshUI();
}

function wireFilters() {
  searchBtn.addEventListener("click", runSearchFilters);
  nameSearch.addEventListener("keydown", (event) => {
    if (event.key === "Enter") runSearchFilters();
  });
  bibSearch.addEventListener("keydown", (event) => {
    if (event.key === "Enter") runSearchFilters();
  });
  eventFilter.addEventListener("keydown", (event) => {
    if (event.key === "Enter") runSearchFilters();
  });
  zoneCategoryFilter.addEventListener("change", (event) => {
    fillZoneDropdown(event.target.value);
    renderZoneLeaderboard();
  });
  zoneFilter.addEventListener("change", () => {
    renderZoneLeaderboard();
  });
}

async function loadData() {
  const [participantsRes, cohortsRes] = await Promise.all([
    fetch("../data/participants.json"),
    fetch("../data/cohorts.json"),
  ]);
  if (!participantsRes.ok || !cohortsRes.ok) {
    throw new Error("Could not load local data files. Run the fetch script first.");
  }
  const [participants, cohorts] = await Promise.all([participantsRes.json(), cohortsRes.json()]);
  setParticipants(participants);
  setCohorts(cohorts);
  indexes = buildIndexes(participants);
  for (const athlete of participants) {
    participantByKey.set(getParticipantKey(athlete), athlete);
  }
  fillEventDropdown();
  fillZoneCategoryDropdown();
  if (zoneCategoryFilter.options.length > 0) {
    zoneCategoryFilter.value = zoneCategoryFilter.options[0].value;
    fillZoneDropdown(zoneCategoryFilter.value);
  }
  wireFilters();

  summaryText.textContent = `${cohorts.race.name} | ${cohorts.totals.participants} participants across ${cohorts.race.events.length} event categories`;

  if (participants.length > 0) {
    setSelectedKey(getParticipantKey(participants[0]));
  }
  refreshUI();
}

loadData().catch((error) => {
  summaryText.textContent = "Failed to load data.";
  detailsContent.innerHTML = `<div class="muted">${error.message}</div>`;
});

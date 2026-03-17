import { getParticipantKey } from "./state.js";

export function renderList({ rows, selectedKey, onSelect, listCountEl, bodyEl }) {
  listCountEl.textContent = `${rows.length} athlete(s) in current view`;
  bodyEl.innerHTML = "";

  for (const athlete of rows) {
    const key = getParticipantKey(athlete);
    const tr = document.createElement("tr");
    tr.className = "clickable";
    if (key === selectedKey) tr.classList.add("active");
    tr.addEventListener("click", () => onSelect(key));

    tr.innerHTML = `
      <td>${athlete.bibNo ?? "-"}</td>
      <td>${athlete.name ?? "-"}</td>
      <td>${athlete.event ?? "-"}</td>
      <td>${athlete.netTime ?? "-"}</td>
      <td>${athlete.categoryRank ?? athlete.overallRank ?? athlete.analytics?.computedEventRank ?? "-"}</td>
    `;
    bodyEl.appendChild(tr);
  }
}

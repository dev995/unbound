import { displayGap, getAthleteComparison, getZoneComparisons } from "./analytics.js";

function metricCard(title, metrics) {
  return `
    <div class="metricCard">
      <h3>${title}</h3>
      <div class="metricRow"><span>Rank</span><strong>${metrics.rank ?? "-"} / ${metrics.total ?? "-"}</strong></div>
      <div class="metricRow"><span>Gap to Leader</span><strong>${displayGap(metrics.gapLeaderSec)}</strong></div>
      <div class="metricRow"><span>Gap to Median</span><strong>${displayGap(metrics.gapMedianSec)}</strong></div>
    </div>
  `;
}

export function renderAthleteDetails({ athlete, indexes, container }) {
  if (!athlete) {
    container.innerHTML = `<div class="muted">Click an athlete to view performance comparisons.</div>`;
    return;
  }

  const comparison = getAthleteComparison(athlete, indexes);
  const zoneComparisons = getZoneComparisons(athlete, indexes);
  const zoneRowsHtml =
    zoneComparisons.length === 0
      ? `<div class="muted">No split/zone timing available for this athlete.</div>`
      : `
        <div class="zoneTableWrap">
        <table class="zoneTable">
          <thead>
            <tr>
              <th>Zone</th>
              <th>Time</th>
              <th>Rank</th>
              <th>Gap to Best</th>
              <th>Gap to Median</th>
            </tr>
          </thead>
          <tbody>
            ${zoneComparisons
              .map(
                (zone) => `
                  <tr>
                    <td>${zone.zone}</td>
                    <td>${zone.time}</td>
                    <td>${zone.rank ?? "-"} / ${zone.total ?? "-"}</td>
                    <td>${displayGap(zone.gapLeaderSec)}</td>
                    <td>${displayGap(zone.gapMedianSec)}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
        </div>
      `;

  container.innerHTML = `
    <div class="metricCard">
      <h3>${athlete.name}</h3>
      <div class="metricRow"><span>Bib</span><strong>${athlete.bibNo ?? "-"}</strong></div>
      <div class="metricRow"><span>Event</span><strong>${athlete.event ?? "-"}</strong></div>
      <div class="metricRow"><span>Gender</span><strong>${athlete.gender ?? "-"}</strong></div>
      <div class="metricRow"><span>Net Time</span><strong>${athlete.netTime ?? "-"}</strong></div>
      <div class="metricRow"><span>Category</span><strong>${athlete.category ?? "-"}</strong></div>
    </div>
    ${metricCard(`Category Comparison: ${athlete.event}`, comparison.category)}
    <div class="metricCard">
      <h3>Zone/Split Comparison (${athlete.event})</h3>
      ${zoneRowsHtml}
    </div>
  `;
}

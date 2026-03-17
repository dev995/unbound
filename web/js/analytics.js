function finiteSeconds(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isDoubleEvent(eventName) {
  return /DOUBLE/i.test(String(eventName || ""));
}

function normalizeBibForTeam(bibNo) {
  return String(bibNo || "")
    .replace(/\s*-\s*[AB]$/i, "")
    .trim();
}

function parseToSeconds(value) {
  if (!value || typeof value !== "string") return null;
  const parts = value.split(":").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function formatSeconds(seconds) {
  if (seconds == null) return "-";
  const sign = seconds < 0 ? "-" : "+";
  const abs = Math.abs(Math.round(seconds));
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  if (h > 0) {
    return `${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(
      s
    ).padStart(2, "0")}`;
  }
  return `${sign}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function buildIndexes(participants) {
  const byEvent = {};
  const zoneTimesByEvent = {};
  for (const athlete of participants) {
    const athleteKey = `${athlete.event}__${athlete.bibNo}__${athlete.name}`;
    const rankKey = isDoubleEvent(athlete.event)
      ? `${athlete.event}__team__${normalizeBibForTeam(athlete.bibNo)}`
      : athleteKey;

    if (!byEvent[athlete.event]) byEvent[athlete.event] = [];
    if (finiteSeconds(athlete.netTimeSeconds) != null) {
      byEvent[athlete.event].push(athlete);
    }

    if (!zoneTimesByEvent[athlete.event]) zoneTimesByEvent[athlete.event] = {};
    const laps = athlete.details?.laps || [];
    for (const lap of laps) {
      const zoneName = lap.distance || "UNKNOWN";
      const zoneSec = parseToSeconds(lap.time);
      if (zoneSec == null) continue;
      if (!zoneTimesByEvent[athlete.event][zoneName]) {
        zoneTimesByEvent[athlete.event][zoneName] = [];
      }
      zoneTimesByEvent[athlete.event][zoneName].push({
        athleteKey,
        rankKey,
        seconds: zoneSec,
      });
    }
  }
  Object.keys(byEvent).forEach((event) => {
    byEvent[event].sort((a, b) => a.netTimeSeconds - b.netTimeSeconds);
  });
  Object.keys(zoneTimesByEvent).forEach((event) => {
    Object.keys(zoneTimesByEvent[event]).forEach((zoneName) => {
      zoneTimesByEvent[event][zoneName].sort((a, b) => a.seconds - b.seconds);
    });
  });

  return { byEvent, zoneTimesByEvent };
}

function rankInSorted(sorted, athlete) {
  if (athlete.netTimeSeconds == null) return null;
  let rank = 1;
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i].netTimeSeconds > sorted[i - 1].netTimeSeconds) {
      rank = i + 1;
    }
    if (
      sorted[i].event === athlete.event &&
      sorted[i].bibNo === athlete.bibNo &&
      sorted[i].name === athlete.name
    ) {
      return rank;
    }
  }
  return null;
}

function computeRankMapForZone(zoneRows) {
  const bestByRankKey = new Map();
  for (const row of zoneRows) {
    const prior = bestByRankKey.get(row.rankKey);
    if (prior == null || row.seconds < prior) {
      bestByRankKey.set(row.rankKey, row.seconds);
    }
  }

  const uniqueRows = Array.from(bestByRankKey.entries())
    .map(([rankKey, seconds]) => ({ rankKey, seconds }))
    .sort((a, b) => a.seconds - b.seconds);

  const rankMap = new Map();
  let currentRank = 1;
  for (let i = 0; i < uniqueRows.length; i += 1) {
    if (i > 0 && uniqueRows[i].seconds > uniqueRows[i - 1].seconds) {
      currentRank = i + 1;
    }
    rankMap.set(uniqueRows[i].rankKey, currentRank);
  }

  return { rankMap, total: uniqueRows.length };
}

export function getAthleteComparison(athlete, indexes) {
  const eventSorted = indexes.byEvent[athlete.event] || [];
  const eventRank = athlete.analytics?.computedEventRank ?? rankInSorted(eventSorted, athlete);
  const eventTimes = eventSorted.map((r) => r.netTimeSeconds);
  const eventLeader = eventTimes[0] ?? null;
  const eventMedian = median(eventTimes);
  const providedRank = athlete.categoryRank ?? athlete.overallRank ?? null;
  const providedTotal = athlete.categoryCount ?? athlete.overallCount ?? null;

  return {
    category: {
      rank: providedRank ?? eventRank,
      total: providedTotal ?? eventSorted.length,
      gapLeaderSec:
        eventLeader != null && athlete.netTimeSeconds != null
          ? athlete.netTimeSeconds - eventLeader
          : null,
      gapMedianSec:
        eventMedian != null && athlete.netTimeSeconds != null
          ? athlete.netTimeSeconds - eventMedian
          : null,
    },
  };
}

function rankKeyForAthlete(athlete) {
  if (isDoubleEvent(athlete.event)) {
    return `${athlete.event}__team__${normalizeBibForTeam(athlete.bibNo)}`;
  }
  return `${athlete.event}__${athlete.bibNo}__${athlete.name}`;
}

export function getZoneRankedRows(eventName, zoneName, indexes) {
  const zoneRows = indexes.zoneTimesByEvent[eventName]?.[zoneName] || [];
  const { rankMap, total } = computeRankMapForZone(zoneRows);
  return zoneRows.map((row) => ({
    ...row,
    rank: rankMap.get(row.rankKey) ?? null,
    total,
  }));
}

export function getZoneComparisons(athlete, indexes) {
  const rankKey = rankKeyForAthlete(athlete);
  const zonesByEvent = indexes.zoneTimesByEvent[athlete.event] || {};
  const athleteLaps = athlete.details?.laps || [];

  return athleteLaps
    .map((lap) => {
      const zoneName = lap.distance || "UNKNOWN";
      const athleteSeconds = parseToSeconds(lap.time);
      if (athleteSeconds == null) return null;
      const zoneRows = zonesByEvent[zoneName] || [];
      const { rankMap, total } = computeRankMapForZone(zoneRows);
      const rank = rankMap.get(rankKey) ?? null;
      const best = zoneRows[0]?.seconds ?? null;
      const med = median(zoneRows.map((row) => row.seconds));
      return {
        zone: zoneName,
        time: lap.time,
        rank,
        total,
        gapLeaderSec: best != null ? athleteSeconds - best : null,
        gapMedianSec: med != null ? athleteSeconds - med : null,
      };
    })
    .filter(Boolean);
}

export function displayGap(seconds) {
  return formatSeconds(seconds);
}

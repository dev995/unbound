#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACE_SLUG = "cult-unbound-championship-2026";
const API_BASE = "https://appapi.racetime.in";
const PAGE_SIZE_GUESS = 10;
const REQUEST_GAP_MS = 120;
const MAX_RETRIES = 4;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const rawDir = path.join(rootDir, "data", "raw");
const dataDir = path.join(rootDir, "data");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toSeconds(value) {
  if (!value || typeof value !== "string") return null;
  const parts = value.split(":").map((part) => Number(part));
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function safeFilePart(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]+/g, "_");
}

async function apiGet(endpoint, params = {}, retry = 0) {
  const url = new URL(`${API_BASE}${endpoint}`);
  Object.entries(params).forEach(([key, value]) =>
    url.searchParams.set(key, String(value))
  );

  try {
    const response = await fetch(url, {
      headers: { "user-agent": "cult-unbound-analytics-fetcher/1.0" },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    const payload = await response.json();
    return payload.data;
  } catch (error) {
    if (retry >= MAX_RETRIES) {
      throw new Error(
        `GET ${endpoint} failed after ${MAX_RETRIES + 1} attempts: ${error.message}`
      );
    }
    const backoff = (retry + 1) * 800;
    await sleep(backoff);
    return apiGet(endpoint, params, retry + 1);
  }
}

function participantKey(record) {
  return `${record.event}__${record.bibNo}__${record.name}`.toLowerCase();
}

function percentile(rank, total) {
  if (!rank || !total || total <= 1) return null;
  const pct = ((total - rank) / (total - 1)) * 100;
  return Number(pct.toFixed(2));
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

function rankByTime(records) {
  const timed = records.filter((r) => typeof r.netTimeSeconds === "number");
  const sorted = [...timed].sort((a, b) => a.netTimeSeconds - b.netTimeSeconds);
  const rankMap = new Map();
  let currentRank = 1;
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i].netTimeSeconds > sorted[i - 1].netTimeSeconds) {
      currentRank = i + 1;
    }
    rankMap.set(participantKey(sorted[i]), currentRank);
  }
  return { rankMap, totalTimed: sorted.length, leader: sorted[0] ?? null, sorted };
}

async function ensureDirs() {
  await mkdir(rawDir, { recursive: true });
}

async function writeJson(filePath, data) {
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

async function fetchAndBuild() {
  await ensureDirs();
  console.log(`Fetching race metadata for ${RACE_SLUG}...`);
  const raceData = await apiGet("/result/events", { race: RACE_SLUG });
  const raceID = raceData.id;
  const events = raceData.events || [];
  await writeJson(path.join(rawDir, "events.json"), raceData);

  const participantMap = new Map();
  const eventCategoryMap = {};
  const listSnapshots = [];
  let apiDetailsCalls = 0;

  for (const event of events) {
    console.log(`\nEvent: ${event}`);
    await sleep(REQUEST_GAP_MS);
    const categories = await apiGet("/result/categories", { raceID, event });
    const normalizedCategories = Array.from(
      new Set(["OVERALL", ...(categories || [])])
    );
    eventCategoryMap[event] = normalizedCategories;
    await writeJson(
      path.join(rawDir, `categories_${safeFilePart(event)}.json`),
      categories
    );

    for (const category of normalizedCategories) {
      console.log(`  Category: ${category}`);
      let page = 1;
      let keepPaging = true;
      while (keepPaging) {
        await sleep(REQUEST_GAP_MS);
        const pageData = await apiGet("/result/list", {
          raceID,
          event,
          gender: "OVERALL",
          category,
          page,
        });
        listSnapshots.push({
          event,
          category,
          page,
          totalPages: pageData.totalPages,
          totalDocs: pageData.totalDocs,
          resultCount: (pageData.results || []).length,
        });
        const rows = pageData.results || [];
        for (const row of rows) {
          const key = participantKey(row);
          if (!participantMap.has(key)) {
            participantMap.set(key, {
              raceID,
              raceName: raceData.name,
              event: row.event || event,
              categoryFromList: category,
              bibNo: row.bibNo,
              name: row.name,
              gender: row.gender,
              netTime: row.netTime ?? null,
              netTimeSeconds: toSeconds(row.netTime),
              overallRank: Number(row.overallRank) || null,
              details: null,
            });
          }
        }
        keepPaging = page < (pageData.totalPages || 1);
        page += 1;
      }
    }
  }

  console.log(`\nFetching per-athlete details (${participantMap.size} athletes)...`);
  const participants = Array.from(participantMap.values());
  for (let i = 0; i < participants.length; i += 1) {
    const athlete = participants[i];
    if (i % 25 === 0) {
      console.log(`  Details progress: ${i}/${participants.length}`);
    }
    await sleep(REQUEST_GAP_MS);
    const details = await apiGet("/result/details", {
      raceID: athlete.raceID,
      event: athlete.event,
      bibNo: athlete.bibNo,
      name: athlete.name,
    });
    apiDetailsCalls += 1;
    athlete.details = details;
    athlete.category = details.category ?? athlete.categoryFromList;
    athlete.gunTime = details.gunTime ?? null;
    athlete.gunTimeSeconds = toSeconds(details.gunTime ?? null);
    athlete.categoryRank = Number(details.categoryRank) || null;
    athlete.genderRank = Number(details.genderRank) || null;
    athlete.overallRank = Number(details.overallRank) || athlete.overallRank;
    athlete.overallCount = Number(details.overallCount) || null;
    athlete.categoryCount = Number(details.categoryCount) || null;
    athlete.genderCount = Number(details.genderCount) || null;
    athlete.team = details.team || null;
    athlete.provisionalResult = Boolean(details.provisionalResult);
  }

  const eventCohorts = {};
  for (const event of events) {
    const eventRecords = participants.filter((p) => p.event === event);
    eventCohorts[event] = rankByTime(eventRecords);
  }

  const participantsNormalized = participants.map((athlete) => {
    const key = participantKey(athlete);
    const eventRankData = eventCohorts[athlete.event];
    const computedEventRank = eventRankData?.rankMap.get(key) || null;
    const eventLeader = eventRankData?.leader?.netTimeSeconds ?? null;
    const eventMedian = median(
      (eventRankData?.sorted || [])
        .map((row) => row.netTimeSeconds)
        .filter((n) => Number.isFinite(n))
    );

    return {
      ...athlete,
      analytics: {
        computedEventRank,
        eventPercentile: percentile(computedEventRank, eventRankData?.totalTimed || null),
        eventGapToLeaderSec:
          eventLeader != null && athlete.netTimeSeconds != null
            ? athlete.netTimeSeconds - eventLeader
            : null,
        eventGapToMedianSec:
          eventMedian != null && athlete.netTimeSeconds != null
            ? athlete.netTimeSeconds - eventMedian
            : null,
      },
    };
  });

  const cohortsOutput = {
    race: {
      id: raceID,
      slug: RACE_SLUG,
      name: raceData.name,
      date: raceData.date,
      events,
    },
    totals: {
      participants: participantsNormalized.length,
      timedParticipants: participantsNormalized.filter((p) => p.netTimeSeconds != null).length,
      detailsCalls: apiDetailsCalls,
    },
    events: events.map((event) => ({
      event,
      categories: eventCategoryMap[event] || [],
      participants: participantsNormalized.filter((p) => p.event === event).length,
      timedParticipants: eventCohorts[event]?.totalTimed || 0,
      leaderTimeSec: eventCohorts[event]?.leader?.netTimeSeconds ?? null,
    })),
  };

  await writeJson(path.join(rawDir, "list_pages_summary.json"), listSnapshots);
  await writeJson(path.join(dataDir, "participants.json"), participantsNormalized);
  await writeJson(path.join(dataDir, "cohorts.json"), cohortsOutput);

  console.log("\nDone.");
  console.log(`Race ID: ${raceID}`);
  console.log(`Participants: ${participantsNormalized.length}`);
  console.log(
    `Timed participants: ${participantsNormalized.filter((p) => p.netTimeSeconds != null).length}`
  );
  console.log(`Saved: data/participants.json, data/cohorts.json, data/raw/*`);
}

fetchAndBuild().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

#!/usr/bin/env node
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dataDir = path.join(root, "data");
const historyDir = path.join(dataDir, "history");
const seedPath = path.join(dataDir, "seed.json");
const latestPath = path.join(dataDir, "latest.json");

const now = new Date();
const fetchedAt = formatHK(now);
const runDate = formatHKDate(now);

if (process.env.HKIPO_FORCE_FAIL === "1") {
  throw new Error("Forced failure via HKIPO_FORCE_FAIL=1");
}

await mkdir(historyDir, { recursive: true });

const base = await loadBaseData();
const sourceChecks = await mapLimit(base.sources || [], Number(process.env.HKIPO_FETCH_CONCURRENCY || 4), checkSource);

const officialPage = sourceChecks.find((s) => s.id === "hkex-new-listings");
const discoveredOfficialLinks = officialPage?.sampleLinks || [];

const output = {
  ...base,
  meta: {
    ...base.meta,
    fetchedAt,
    runDate,
    dataStatus: sourceChecks.some((s) => s.ok) ? "verified-refresh" : "stale-no-source-ok",
    generatedBy: "scripts/fetch-hkipo.mjs",
    sourcePriority: "HKEX/prospectus > company announcement > broker > media",
    unresolvedPolicy: "Unverified fields stay marked pending; no guessed fill-ins."
  },
  sourceChecks,
  discoveredOfficialLinks,
  audit: {
    sourceCount: sourceChecks.length,
    okSourceCount: sourceChecks.filter((s) => s.ok).length,
    failedSourceCount: sourceChecks.filter((s) => !s.ok).length,
    fetchedAt
  }
};

await writeJson(latestPath, output);
await writeJson(path.join(historyDir, `${runDate}.json`), output);

console.log(`HK IPO data refreshed: ${output.audit.okSourceCount}/${output.audit.sourceCount} sources OK`);

async function loadBaseData() {
  if (existsSync(latestPath)) {
    try {
      return JSON.parse(await readFile(latestPath, "utf8"));
    } catch {
      await copyFile(latestPath, `${latestPath}.corrupt-${Date.now()}`).catch(() => {});
    }
  }
  return JSON.parse(await readFile(seedPath, "utf8"));
}

async function checkSource(source) {
  const startedAt = Date.now();
  const timeoutMs = Number(process.env.HKIPO_FETCH_TIMEOUT_MS || 90000);
  const result = {
    id: source.id,
    name: source.name,
    priority: source.priority,
    url: source.url,
    fetchedAt,
    ok: false,
    status: "待核实",
    httpStatus: null,
    contentType: null,
    bytes: 0,
    elapsedMs: 0,
    error: null
  };

  let timeout;
  try {
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(source.url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 HKIPOTurnoverCalendar/0.1 (+public-source-check)"
      }
    });
    result.httpStatus = response.status;
    result.contentType = response.headers.get("content-type");
    const arrayBuffer = await response.arrayBuffer();
    result.bytes = arrayBuffer.byteLength;
    result.ok = response.ok && result.bytes > 0;
    result.status = result.ok ? "verified" : "待核实";

    if (source.id === "hkex-new-listings" && result.ok) {
      const text = new TextDecoder("utf-8", { fatal: false }).decode(arrayBuffer);
      result.sampleLinks = extractHKEXLinks(text);
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  } finally {
    if (timeout) clearTimeout(timeout);
    result.elapsedMs = Date.now() - startedAt;
  }

  return result;
}

async function mapLimit(items, limit, mapper) {
  const output = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length || 1)) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      output[current] = await mapper(items[current], current);
    }
  });
  await Promise.all(workers);
  return output;
}

function extractHKEXLinks(html) {
  const links = new Set();
  const re = /href=["']([^"']*listedco\/listconews\/sehk\/[^"']+?\.pdf[^"']*)["']/gi;
  for (const match of html.matchAll(re)) {
    const href = match[1].replace(/&amp;/g, "&");
    links.add(href.startsWith("http") ? href : `https://www1.hkexnews.hk${href.startsWith("/") ? "" : "/"}${href}`);
    if (links.size >= 30) break;
  }
  return [...links];
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function formatHK(date) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}+08:00`;
}

function formatHKDate(date) {
  return formatHK(date).slice(0, 10);
}

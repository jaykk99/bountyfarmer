// fetch-bounties.mjs — pull REAL open bounties from the public GitHub API (keyless).
// Usage: node scripts/fetch-bounties.mjs
// Writes: data/github-bounties.json
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "github-bounties.json");

const QUERIES = [
  "label:bounty+state:open",          // issues explicitly labeled "bounty"
  "bounty+in:title+state:open",       // "bounty" in the title
];

const HEADERS = {
  "Accept": "application/vnd.github+json",
  "User-Agent": "bountyfarmer-aggregator",
};

// Grab the biggest plausible dollar figure mentioned in title/body.
function extractAmount(text) {
  const m = [...text.matchAll(/\$[\s]*([\d][\d,]*)(?:\.\d{1,2})?/g)];
  let best = 0;
  for (const x of m) {
    const n = Number(x[1].replace(/,/g, ""));
    // ignore version numbers / tiny numbers that are obviously not bounties
    if (n >= 5 && n <= 10_000_000 && n > best) best = n;
  }
  // also match "500 USD", "1500 USDC", "1000 dollars"
  const m2 = [...text.matchAll(/\b([\d][\d,]*)\s?(USD|USDC|dollars?)\b/gi)];
  for (const x of m2) {
    const n = Number(x[1].replace(/,/g, ""));
    if (n >= 5 && n <= 10_000_000 && n > best) best = n;
  }
  return best || null;
}

function clean(s) {
  return (s || "").replace(/\s+/g, " ").trim();
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${url}`);
  const remaining = res.headers.get("x-ratelimit-remaining");
  console.log(`GET ${url} -> ${res.status} (ratelimit remaining: ${remaining})`);
  return res.json();
}

const SPAM_REPOS = [
  /bounty-plaza/i,          // bot mirror of other projects' bounties
  /bountyscout/i,           // bot digest noise
  /bounty-?alert/i,
];
const JOKE_RE = /\b(doolar|money bucks|free money|omiblocks|gta ?6 mode)\b/i;
const ALERT_TITLE_RE = /bounty alert|micro bounty alert|opportunit(y|ies) found/i;

function isSpam(it) {
  if (SPAM_REPOS.some((r) => r.test(it.repo))) return true;
  if (JOKE_RE.test(it.title)) return true;
  if (ALERT_TITLE_RE.test(it.title)) return true;
  return false;
}

const seen = new Map();
for (const q of QUERIES) {
  const url = `https://api.github.com/search/issues?q=${q}&sort=created&order=desc&per_page=100`;
  let data;
  try {
    data = await fetchJson(url);
  } catch (e) {
    console.error("query failed:", q, "-", e.message);
    continue;
  }
  for (const it of data.items || []) {
    if (seen.has(it.id)) continue;
    const text = `${it.title}\n${it.body || ""}`;
    const repo = (it.repository_url || "").replace("https://api.github.com/repos/", "");
    seen.set(it.id, {
      id: `gh-${it.id}`,
      source: "github",
      title: clean(it.title),
      repo,
      url: it.html_url,
      labels: (it.labels || []).map((l) => (typeof l === "string" ? l : l.name)),
      amount_usd: extractAmount(text),
      state: it.state,
      created_at: it.created_at,
      updated_at: it.updated_at,
      comments: it.comments,
    });
  }
}

const items = [...seen.values()]
  .filter((i) => !isSpam(i))
  .sort((a, b) => (b.amount_usd || 0) - (a.amount_usd || 0));
const priced = items.filter((i) => i.amount_usd);

mkdirSync(join(ROOT, "data"), { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify(
    {
      fetched_at: new Date().toISOString(),
      count: items.length,
      with_amount: priced.length,
      items,
    },
    null,
    2
  )
);
console.log(`wrote ${OUT}: ${items.length} bounties (${priced.length} with a dollar figure)`);

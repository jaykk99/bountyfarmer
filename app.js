// bountyfarmer — real bounty aggregation, keyless.
// Loads the snapshot harvested by scripts/fetch-bounties.mjs + curated platforms.
// "Refresh live" re-queries the public GitHub API straight from the browser.
"use strict";

const state = { issues: [], programs: [], fetchedAt: null, live: false };

const $ = (id) => document.getElementById(id);
const grid = $("issue-grid"), pgrid = $("program-grid"), empty = $("empty");

const fmtUSD = (n) =>
  n == null ? null : "$" + n.toLocaleString("en-US");

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const timeAgo = (iso) => {
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (d < 1) return "today";
  if (d < 2) return "yesterday";
  if (d < 30) return Math.floor(d) + "d ago";
  if (d < 365) return Math.floor(d / 30) + "mo ago";
  return Math.floor(d / 365) + "y ago";
};

function issueCard(i) {
  const amt = fmtUSD(i.amount_usd);
  const labels = (i.labels || []).slice(0, 4).map((l) => `<span class="label">${esc(l)}</span>`).join("");
  return `<article class="card">
    <div class="card-top">
      <span class="kind">🐙 GitHub issue</span>
      ${amt ? `<span class="amount">${esc(amt)}</span>` : `<span class="amount unknown">amount not listed</span>`}
    </div>
    <h3><a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.title)}</a></h3>
    <div class="repo">${esc(i.repo)}</div>
    <div class="labels">${labels}</div>
    <div class="meta">updated ${esc(timeAgo(i.updated_at))} · ${i.comments ?? 0} comments · open</div>
    <a class="claim" href="${esc(i.url)}" target="_blank" rel="noopener">Claim it →</a>
  </article>`;
}

function programCard(p) {
  const kindIcon = p.kind === "security" ? "🛡️" : "💻";
  return `<article class="card">
    <div class="card-top">
      <span class="kind">${kindIcon} bounty platform</span>
      <span class="amount">${esc(p.payout)}</span>
    </div>
    <h3><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.name)}</a></h3>
    <p class="blurb">${esc(p.blurb)}</p>
    <a class="claim" href="${esc(p.url)}" target="_blank" rel="noopener">Browse bounties →</a>
  </article>`;
}

function getFiltered() {
  const q = $("search").value.trim().toLowerCase();
  const src = $("source-filter").value;
  const minAmt = Number($("amount-filter").value);
  const sort = $("sort").value;

  let issues = state.issues.filter((i) => {
    if (src === "program") return false;
    if (minAmt && !(i.amount_usd && i.amount_usd >= minAmt)) return false;
    if (q) {
      const hay = `${i.title} ${i.repo} ${(i.labels || []).join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const showPrograms = src !== "github" && minAmt === 0 &&
    (!q || state.programs.some((p) => `${p.name} ${p.blurb}`.toLowerCase().includes(q)));

  issues.sort((a, b) =>
    sort === "new" ? new Date(b.created_at) - new Date(a.created_at)
    : sort === "updated" ? new Date(b.updated_at) - new Date(a.updated_at)
    : (b.amount_usd || 0) - (a.amount_usd || 0));

  let programs = state.programs;
  if (q) programs = programs.filter((p) => `${p.name} ${p.blurb}`.toLowerCase().includes(q));
  return { issues, programs: showPrograms ? programs : [] };
}

function render() {
  const { issues, programs } = getFiltered();
  grid.innerHTML = issues.map(issueCard).join("");
  pgrid.innerHTML = programs.map(programCard).join("");
  empty.hidden = issues.length > 0;
  $("issue-count").textContent = `(${issues.length} showing)`;
  document.querySelector(".programs").style.display = programs.length ? "" : "none";
}

function renderStats() {
  const priced = state.issues.filter((i) => i.amount_usd);
  const total = priced.reduce((s, i) => s + i.amount_usd, 0);
  const repos = new Set(state.issues.map((i) => i.repo)).size + state.programs.length;
  $("stat-count").textContent = state.issues.length;
  $("stat-payout").textContent = fmtUSD(total) || "$0";
  $("stat-repos").textContent = repos;
  $("freshness").textContent = state.fetchedAt
    ? `🌾 Harvested ${state.live ? "live from the GitHub API" : "from the GitHub API"} · ${new Date(state.fetchedAt).toLocaleString()}${state.live ? "" : " · hit “refresh live” for the freshest crop"}`
    : "";
}

async function loadSnapshot() {
  const [issues, programs] = await Promise.all([
    fetch("data/github-bounties.json").then((r) => r.json()),
    fetch("data/seed-programs.json").then((r) => r.json()),
  ]);
  state.issues = issues.items;
  state.programs = programs;
  state.fetchedAt = issues.fetched_at;
  renderStats();
  render();
}

// Re-fetch directly from the public GitHub API (unauthenticated, keyless).
async function refreshLive() {
  const btn = $("refresh");
  btn.disabled = true;
  btn.textContent = "↻ harvesting…";
  try {
    const seen = new Map();
    for (const q of ["label:bounty+state:open", "bounty+in:title+state:open"]) {
      const url = `https://api.github.com/search/issues?q=${q}&sort=created&order=desc&per_page=100`;
      const res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
      if (!res.ok) throw new Error(`GitHub API ${res.status} — rate limit may be hit, try again in a few minutes`);
      const data = await res.json();
      for (const it of data.items || []) {
        if (seen.has(it.id)) continue;
        const text = `${it.title}\n${it.body || ""}`;
        const repo = (it.repository_url || "").replace("https://api.github.com/repos/", "");
        if (/bounty-plaza|bountyscout/i.test(repo)) continue;
        if (/doolar|money bucks|bounty alert|opportunit(y|ies) found/i.test(it.title)) continue;
        let best = 0;
        for (const m of text.matchAll(/\$[\s]*([\d][\d,]*)(?:\.\d{1,2})?/g)) {
          const n = Number(m[1].replace(/,/g, ""));
          if (n >= 5 && n <= 10_000_000 && n > best) best = n;
        }
        seen.set(it.id, {
          id: `gh-${it.id}`, title: it.title, repo, url: it.html_url,
          labels: (it.labels || []).map((l) => l.name || l),
          amount_usd: best || null, updated_at: it.updated_at,
          created_at: it.created_at, comments: it.comments,
        });
      }
    }
    state.issues = [...seen.values()];
    state.fetchedAt = new Date().toISOString();
    state.live = true;
    renderStats();
    render();
  } catch (e) {
    alert("Live refresh failed: " + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "↻ refresh live";
  }
}

["search", "source-filter", "amount-filter", "sort"].forEach((id) =>
  $(id).addEventListener("input", render));
$("refresh").addEventListener("click", refreshLive);

loadSnapshot().catch((e) => {
  grid.innerHTML = `<p class="empty">Couldn't load the harvest (${esc(e.message)}). The fields are temporarily barren.</p>`;
});

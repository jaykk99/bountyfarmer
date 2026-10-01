# 🌾 bountyfarmer

**Till the fields of free money bucks.** A real, open-source bounty aggregator dashboard.
Every listing is REAL — no fake money bucks. If it's on the page, someone actually posted it.

## What it does

- **Aggregates real open bounties** from the public GitHub API (issues labeled
  `bounty`, plus issues with "bounty" in the title) — keyless, no API key needed.
- **Dollar figures parsed** from issue text (`$1,500`, `750 USD`, …) so you can
  sort by biggest payout first.
- **Curated bounty platforms** (Gitcoin, IssueHunt, HackerOne, Bugcrowd) as
  verified-live cards that link out to the real programs.
- **Dashboard**: search, source filter, minimum-amount filter, sort by
  amount / newest / recently updated. Mobile-friendly.
- **↻ refresh live** button re-fetches straight from the GitHub API in the
  browser (unauthenticated rate limits apply — go easy, farmer).

Spam/joke issues (bot mirrors, bot alert digests, DOOLAR-grade jokes) are
filtered out of the harvest.

## Project layout

```
index.html                  dashboard
styles.css                  farm-fresh styling
app.js                      rendering, filters, live refresh
data/github-bounties.json   snapshot of the GitHub harvest (regenerate below)
data/seed-programs.json     curated bounty platforms (hand-verified links)
scripts/fetch-bounties.mjs  re-harvest: node scripts/fetch-bounties.mjs
```

## Re-harvest the data

```bash
node scripts/fetch-bounties.mjs   # writes data/github-bounties.json
```

## Deploy

Static site — no build step. Point Vercel (or any static host) at this repo.

## The original joke, preserved

This repo started life as a joke script that generated million-dollar bounties
for implementing "GTA 6 MODE" into OmniBlocks. The humor stayed. The fake
bounties did not.

---

*Not financial advice. The crops are real; the farming metaphor is not.* 🤑

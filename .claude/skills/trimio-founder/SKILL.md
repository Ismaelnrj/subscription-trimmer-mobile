---
name: trimio-founder
description: Use for a Trimio business question rather than code, such as pricing, positioning, competitors, unit economics and break even, the trial or the offer, a marketing or launch plan, a business plan, or "would people pay for this". Carries the eleven founder playbooks (board, competitors, consumer panel, pricing, offer, CFO, marketing, brand, ops, launch, plan) behind the decisions the owner has already made, so a playbook never reopens a settled question on simulated evidence.
---

# Trimio business decisions

The eleven playbooks of Jake Schincariol's founder-skill (MIT) are in
`upstream/skills/founder-<name>/PLAYBOOK.md`, unchanged except that each
`SKILL.md` was renamed so they do not register as eleven skills competing with
trimio-design, trimio-social and superpowers for the same requests. Open the
one the job needs, after this file. Provenance: `UPSTREAM.md`.

## Settled: start from these, do not re-derive them

| Question | Decision | What reopens it |
|---|---|---|
| Price | €3.99 a month, €24.99 a year, lifetime kept (owner, 2026-11-07; live in Play 2026-11-08) | Real funnel numbers: `paywall_viewed` against `upgrade_completed` in PostHog, `trial.paid` and `atFreeLimit` from `/api/admin/funnel`. Never a simulated panel |
| Trial | Reverse trial: 14 days of Premium for every new account, no card | Fewer than 1 in 15 new accounts paying within 30 days; the agreed fallback is a hard paywall with a priced Play trial |
| Free tier | 5 subscriptions (`FREE_SUBSCRIPTION_LIMIT`) | The owner |
| Name | Trimio stays (TMview clear, 2026-10-18) | Only a legal problem. founder-brand's naming step does not apply |
| Look and copy | trimio-design owns colour, type and every rule for words | founder-brand's look brief does not apply |
| Product facts | Android only, English and German, manual entry plus paste, no bank link, over 30 cancel guides | What the code does; trimio-social lists the claims a post may make |
| Paid track | Boost a proven organic clip first, then a small always on test, about €200 a month | Evidence that a clip is proven |
| Competitors | Researched 2026-09-21 (`docs/history.md`, "THE COMPETITION WAS RESEARCHED") | Refresh that table; do not start from zero |

## Real numbers beat simulated ones

In order: `/api/admin/funnel` (the owner runs it, the secret is theirs), Play
Console (installs by tagged source, store listing conversion), PostHog (the
client funnel), RevenueCat (purchases). founder-consumer's panel is simulated
buyers: use it to find objections and wording, never as evidence for a price,
never as a quote in marketing. Language models lean agreeable, so its buy rate
is an upper bound.

## Ask before anything that runs many agents

founder-consumer runs one subagent per buyer, 100 by default, and
founder-board runs three. On 2026-11-17 five agents at once hit the owner's
five hour usage limit twice and stopped the session. So: ask the owner before a
panel, say how many agents it is, default to `--quick` (20), and run at most
three at a time.

## Which playbook

| The job | Open |
|---|---|
| Pressure test an idea or a feature bet | `upstream/skills/founder-board/PLAYBOOK.md` (lenses in `lenses.md` beside it) |
| Who else is there, what they charge, what their users hate | `founder-competitors` |
| What buyers object to, in their words | `founder-consumer` (ask first, see above) |
| A price test inside the decided range | `founder-pricing` |
| What makes the trial or Premium an easy yes | `founder-offer` |
| Unit economics: Railway, Brevo, Play's fee, break even in subscribers | `founder-cfo` |
| A 30 day campaign, channels, hooks | `founder-marketing`, then trimio-social for every post it plans |
| Running the business day to day | `founder-ops` |
| A dated launch or relaunch with a real test first | `founder-launch` |
| One plan with a computed verdict | `founder-plan` |
| Name, voice, look | Already decided; see the table above |

## Paths and tools

A playbook's `${CLAUDE_SKILL_DIR}` is its own folder,
`.claude/skills/trimio-founder/upstream/skills/founder-<name>/`, so its tools
run as, for example,
`python3 .claude/skills/trimio-founder/upstream/skills/founder-cfo/unit_economics.py founder/numbers.json`.
Standard library Python, no network. Their tests:
`cd .claude/skills/trimio-founder/upstream && python3 -I -m unittest discover -s tests -p "test_[cpu]*.py"`
(22 pass). The playbooks write to `founder/` at the repo root: research, never
part of an app bundle or the backend.

## Where Trimio's rules win over a playbook

- Every post a plan produces goes through trimio-social's gate.
- Every sentence a user will read follows trimio-design's copy rules (no dash as
  clause punctuation, "…", German money and quotes).
- Nothing scheduled without asking (CLAUDE.md).
- Not financial, legal or tax advice: say so once when money or law is in play.

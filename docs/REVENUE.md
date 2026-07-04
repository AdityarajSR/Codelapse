# Codelapse — Revenue Plan (how it stays free forever)

Goal: cover costs and earn a modest surplus **without ever charging a student to learn.**

> **2026-07-04 update:** Monetization is **deferred** — nothing in this file is switched on now. The near-term
> job is **reach + depth** (see PLAN.md), and a paywall on a free learning tool would kill the growth it depends
> on. Two other changes: there is now a **real (if modest) server cost** to offset — running the Go/compiled-language
> tier on the home box (electricity, bandwidth, ops time) — and **AI features are out of scope**, so the old
> "metered AI-explain" lever is removed. This file is the parked plan we revisit *only once real traffic exists*.

## The one rule

**Never paywall understanding.** Watching your code run is free forever. We monetize
*saving, exporting, teaching, and scale* — the things power users and institutions value —
not the core learning moment. This is what keeps growth alive; a paywall on a "silly free
tool" kills it.

## What we actually run now: nothing

At launch we switch on **no monetization**. We ship a self-hosted, cookieless analytics counter (Umami) so we
can *see* whether traffic arrives. Everything below is parked until it does.

## Tier A — turn on once there's a real audience (zero UX harm)

1. **Donate** — a quiet "buy me a coffee" button (Python Tutor has one, and it works).
   Use **Razorpay/UPI** (India-friendly) + **Ko-fi / GitHub Sponsors** for global. A handful
   of donations covers the domain **and the home box's electricity**. *(Deferred — not day one.)*
2. **Affiliate links in blog + examples** (not in the tool) — when a post teaches recursion or
   sorting, link the relevant book/course (Amazon, Udemy, Coursera, educative affiliates).
   Educational and non-intrusive.
3. **Ethical dev ads** — **not** AdSense banner spam. Use **EthicalAds** or **Carbon Ads**:
   a single tasteful, privacy-friendly, developer-targeted placement (the kind dev tools run).
   Needs traffic (~50k views/mo) to qualify, so it's a "once we have an audience" lever, not day one.

## Tier B — product-led, once there are repeat users

4. **Pro conveniences (ethical freemium)** — keep all learning free; charge only for:
   - **Export the animation as GIF/MP4** — genuinely valuable to teachers and content creators,
     real willingness to pay. Likely our best paid feature (and the home box can render it server-side).
   - private saved library of runs · custom themes · higher step limits · no ads.
5. **Teacher / classroom tier** — embed mode + a class view where a teacher shares visualized
   runs with students. Coaching centers and colleges (huge in India for placement prep) may pay
   a small annual fee. B2B2C.
6. **Sponsored example packs / "powered by"** — a bootcamp or edtech sponsors an example set
   ("DSA interview pack, sponsored by X"). Native, not annoying.

## Tier C — creative / novel

7. **Grants / education sponsorships** — PSF, GitHub Education, edtech grants for free CS tools.
   Non-dilutive, on-mission.
8. **Cross-promotion with PlacementOS** — Codelapse is a free, viral, top-of-funnel student
   magnet. It can quietly funnel motivated students toward the paid placement product (and vice
   versa). A revenue lever we're uniquely positioned to pull that no competitor has.

> *(Removed: the earlier "metered AI-explain as Pro" idea. AI is out of scope, so there's no inference cost
> to align against and no such feature to gate.)*

## Honest economics (no overselling)

- Ads on a student tool = low CPM. Near-term reality: **donations + affiliate** carry costs;
  **ads + Pro-export** scale with traffic; **teacher/institution** is the real money later.
- Costs to cover are now **domain (~₹1,000/yr) + home-server electricity/bandwidth** for the server tier.
  Both are small; the browser tier (Python/JS/TS) remains genuinely ~$0 to serve.

## When we revisit (not now)

1. Ship free. Watch analytics. Do nothing revenue-wise until there's sustained traffic.
2. Then, in order: **Donate button** (Razorpay + Ko-fi) → affiliate links in the first blog posts →
   EthicalAds once traffic clears their threshold → **Pro GIF/MP4 export** once repeat teachers/creators appear.

Everything past that is optional and only pursued if we *want* Codelapse to be a business
rather than a free public good. The architecture keeps the **browser tier** free-forever by default; the
server tier's modest cost is the only thing donations/Pro-export need to offset.

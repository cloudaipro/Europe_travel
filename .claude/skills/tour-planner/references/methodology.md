# Methodology — Pacing, Clustering, and Anchor Scoring

This document distills the research and field practices behind the skill's planning decisions. Read it when you need to justify a sequencing choice or hit an edge case.

## The five evidence-grounded principles

1. **Geographic clustering before optimization.** Academic literature on the Tourist Trip Design Problem (TTDP) shows clustering by neighborhood is the dominant approach because it lowers transit overhead *and* reduces decision fatigue for the traveler reading the plan. Hard rule: don't leave a neighborhood with a stop unvisited; come back tomorrow if you must.

2. **Anchor + filler.** Professional tour design (Xola, Checkfront, Rick Steves) treats each half-day as one fixed *anchor* (timed or ticketed) plus 1–3 *fillers* (cafés, viewpoints, browse-able streets) that flex with weather and mood. Anchors give structure; fillers give breathing room.

3. **Pacing must be "livable".** Reasonable wake-up times, free blocks of 60–90 min for shopping or rest, and a hard cap on heavy-cognition stops per day (1 major museum, max 2 timed tours). Travelers exhausted by lunch on Day 2 stop following the plan.

4. **Energy curve.** Front-load high-energy items in the morning, taper into lunch, mid-effort afternoon, relaxation at golden hour, dinner, optional nightlife. The body and the light both cooperate.

5. **Decision fatigue is the silent killer.** Each option is a tax. Limit choices per slot to 3–4. Default to a recommended pick. Mark optional vs required.

## Pacing math

Use this table to convert duration × pace into a target number of stops:

| Pace      | Anchors/day | Fillers/day | Walking budget | Down time |
|-----------|-------------|-------------|----------------|-----------|
| Slow      | 1           | 1–2         | < 4 km         | ≥ 3 hr    |
| Balanced  | 2           | 2–3         | 4–8 km         | 1–2 hr    |
| Intense   | 3           | 2–4         | 8–12 km        | < 1 hr    |

A balanced pace 3-day Budapest-sized trip lands around 6 anchors + 8 fillers + 3 meals/day = 14 named stops + meals. That's a lot — that's why per-stop layering matters.

If the user is over 65, traveling with kids under 6, or has flagged any mobility constraint, default to slow. If the user is on a 2-day stopover and treating the trip as "see as much as possible", offer intense but recommend balanced.

## Anchor scoring (0–9 composite)

Score each candidate 0–3 on each axis, sum:

- **Source weight**: how often / how prominently the user's source mentioned it
- **Style match**: alignment with the user's stated style (classic/foodie/quirky/mix)
- **Anchor potential**:
  - 3 = timed/ticketed/iconic (Parliament tour, sunset at the lookout)
  - 2 = signature view or one-of-a-kind (Fisherman's Bastion, Heroes' Square)
  - 1 = nice-to-have, photogenic, brief stop
  - 0 = passive filler (a square, a café, a street)

A score ≥ 6 → likely anchor candidate. A score 3–5 → filler. A score < 3 → drop unless quirky-style budget allows.

## Geographic clustering — practical rules

- Cluster radius ≈ 10 minutes walking (~800 m).
- Adjacent clusters connected by one tram or bus line count as "linkable" — combinable in one half-day if pace allows.
- Cross-river crossings cost ~15 min; budget accordingly. In Budapest, cross the Chain Bridge once per day max.
- Avoid backtracking. If a stop is on the way out of a cluster, place it at the end. If it's on the way in, place it first.

## Energy curve worked example

A balanced day with 2 anchors + 2 fillers:

```
08:30  Breakfast at hotel
09:30  ANCHOR: timed museum tour (highest cognition first)
11:30  FILLER: scenic walk through nearby market square
12:30  Lunch at a long-table local restaurant (75 min, sit-down)
14:00  ANCHOR: viewpoint walk-up (higher physical effort, easier on the brain)
16:00  FILLER: historic café for cake and a sit
17:30  Free block — return to hotel, change, light rest
19:30  Dinner (booked)
21:30  Optional: night cruise / illuminated bridge stroll
```

This shape — heavy → light → meal → outdoor → calorie → rest → meal → optional — repeats well across cultures with timing shifted.

## Closure validation gates

Before locking the plan, run this checklist against each stop:

- [ ] Is it open the day you're sending the user? (Common pitfalls: Monday closures across European museums; Sunday closures of markets, traditional restaurants, and many shops)
- [ ] Last entry — does it require arrival > 1 hr before close?
- [ ] Seasonal hour reductions (off-season Oct–Mar usually cuts hours by 1–2 hr)
- [ ] Religious sites — closed during services? (Friday afternoons for mosques, Saturday for synagogues, Sunday morning for churches)
- [ ] Day-of-week markets (most farmers' markets only run 1–2 days/week)
- [ ] Holidays in the destination (national days can close museums or open free entry — both worth flagging)

If you find a closure conflict, swap days don't drop stops.

## Cultural rhythm — meal timing matrix

Hungarian: lunch 12–14, dinner 19–21
Spanish: lunch 14–16, dinner 21–23
French: lunch 12–14, dinner 19:30–22
Japanese: lunch 11:30–13:30, dinner 18–21
Mediterranean coastal: siesta 14–17, dinner 20–23
Northern European: dinner often by 19:00; restaurants stop seating by 21:00

Match the user's meal slots to the destination, or they'll arrive at locked doors.

## Buffer time and the "20% rule"

Add 20% buffer to every transit estimate. Queues, mood, weather, "let me just take one more photo." A plan that runs 5 hours of tight transit will fail; a plan that budgets 6 hours feels generous.

## Backups for everything

For each major outdoor stop, name an indoor backup in the same neighborhood. Examples:

- Gellért Hill hike fails (rain) → Gellért Bath instead, just below
- Chain Bridge stroll fails (winter, no light) → New York Café and read indoors
- Heroes' Square photo fails (downpour) → Museum of Fine Arts on the same square

## What the research disagrees with

- Some optimization papers (genetic algorithms, K-means TSP) try to globally optimize the entire trip. In practice, **clusters + sequencing within clusters** beats global optimization for human users — the resulting plans feel coherent rather than zigzagging "optimal" routes.
- "Maximize POIs visited" is a bad objective. Maximize *experience density* — fewer stops, each meaningful.
- Real-time replanning algorithms exist but add cognitive load. Better to give the user 2–3 named alternatives per slot and let them choose in the moment.

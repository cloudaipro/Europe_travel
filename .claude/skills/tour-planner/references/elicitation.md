# Elicitation — Asking the Right Four Questions

Skip this phase and you build a generic plan that misses the user's actual trip. Ask too much and you fatigue them before the work starts. Four questions, asked once, in a single batch.

## The canonical four

Adapt phrasing to the destination. Always include one option marked "Recommended" so a quick-clicking user gets a sensible default.

### Question 1 — Season / dates

The single highest-leverage question. Cherry blossoms, Christmas markets, monsoons, cicadas, sunset at 16:00 vs 21:00 — all driven by this one answer. If the user already gave specific dates, skip this question.

Format: 4 season buckets, named with what's specifically interesting about that season at the destination.

Example for Budapest: "Summer (St. Stephen's Day fireworks)" / "Autumn (mild, fewer crowds)" / "Winter (Christmas markets)" / "Spring (cherry blossoms, Mar 15 National Day)".

### Question 2 — Style

What kind of trip? This determines which candidates from your source list become anchors vs which get cut. Common buckets:

- **Classic highlights** — every iconic must-see
- **Foodie / café focus** — markets, restaurants, coffee houses, a cooking class
- **Quirky / hidden** — non-obvious attractions, mini-statue hunts, abandoned places, niche museums
- **Nature / outdoors** — parks, hikes, viewpoints, water
- **Mix of all** — balanced (this is the most common pick — make it Recommended)

### Question 3 — Pace + day-trip openness

Two related decisions in one question:

- **All in the city** vs **a day-trip**
- (If a day-trip) which destination — surface 1–2 famous nearby options

For trips ≥ 3 days, day trips become more viable. For 2-day trips, generally keep them in the city.

### Question 4 — Output format

Pin this early so you don't rebuild later. Options:

- **Markdown file** with addresses, maps, images (Recommended for most users)
- **DOCX / Word document** (printable, formal)
- **Both**
- **Just here in chat** (rare — only if user is at a desktop and won't reopen later)

## Secondary questions — only if the trigger is hot

Don't ask these unprompted. Add them only when the user has already signaled the relevant constraint.

| Trigger | Question |
|---------|----------|
| User said "with my parents" / over-65 / mentioned mobility | Pace? (Slow / Balanced / Intense) |
| User mentioned "kids" or shared a family photo | Ages of children? — affects museum vs park ratio |
| User mentioned "vegetarian / vegan / halal / gluten-free" | Already known — surface dietary-friendly restaurants in food guide |
| User mentioned "tight budget" / "student" | Tier — budget tips alongside main picks |
| User mentioned "first international trip" / "anxious traveler" | Add packing list and phrasebook by default |
| User has a partner with different style | Two-line "balance" — e.g., "morning museums, afternoon food" |

## When to skip the elicitation entirely

- The user already specified all four answers in their prompt ("3 days in Budapest in spring, balanced pace, mixed interests, give me a Word doc").
- The conversation history has prior answers — read it before asking.
- The user said "just plan it, surprise me" — pick balanced + classic + markdown by default and tell them you defaulted.

## Question phrasing — a worked example

A Budapest 3-day prompt without other context. A clean batched ask:

> Q1 — When are you visiting Budapest?
>   • Summer (Aug 20 fireworks)
>   • Autumn (mild, fewer crowds)
>   • Winter / Christmas markets
>   • Spring (Mar–May cherry blossoms) [Recommended]
>
> Q2 — What kind of trip?
>   • Classic highlights
>   • Foodie + café focus
>   • Quirky / hidden gems
>   • Mix of all three [Recommended]
>
> Q3 — Day trip outside Budapest on Day 3?
>   • No — stay in Budapest
>   • Danube Bend (Szentendre)
>   • Lake Balaton / Tihany
>
> Q4 — How should I deliver the itinerary?
>   • Markdown file [Recommended]
>   • Word document (.docx)
>   • Both
>   • Just here in chat

After these answers, plan immediately. Don't come back and ask about restaurants — pick from the destination's well-known list and let the user adjust later.

## What to do if the user gives unexpected answers

- "Other" with custom text → take it at face value, plan around it.
- Conflicting answers (slow pace + intense schedule) → pick the more conservative interpretation; mention you erred toward livable.
- "I don't know" / "you choose" → treat as recommended-default + mention the defaults you picked at the top of the doc, so they can override later.

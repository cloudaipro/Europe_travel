# Companion Documents

The primary itinerary is the spine. Companion docs add depth without bloating the spine. Produce them only when they clearly help — not as a flex.

## When to produce which

| Doc | Default trigger | Skip when |
|-----|-----------------|-----------|
| `food.md` | Trip ≥ 2 days, or user mentioned food/foodie style | User asked specifically for nightlife/shopping focus |
| `phrasebook.md` | Foreign language at destination AND trip ≥ 3 days | User speaks the language; or it's English-speaking |
| `packing_list.md` | User asked, or "first international trip" / "what should I bring" mentioned | Repeat traveler / weekend trip |
| `budget.md` | User signaled budget concern explicitly | User signaled premium / luxury |
| `map_summary.md` | Always — append at the bottom of the main itinerary, not a separate file | n/a |

Always **offer** before creating beyond food.md. Don't surprise the user with five files.

## food.md — Cuisine guide

Structure that worked for Budapest:

```markdown
# <Cuisine> Food Guide — <City> Edition

<Opening paragraph — what this cuisine is about, one geographic/historical
hook, paired with a recommended drink.>

This guide pairs with the [<N>-day <City> itinerary](<itinerary-filename>.md).

## The Big Picture: 5 Things to Know
1. The defining ingredient or technique.
2. The mealtime convention (when locals eat lunch/dinner).
3. The "thing tourists get wrong" myth-buster.
4. The bread/grain norm.
5. The drinking convention.

## Soups / Starters
### <Dish name (Local Name)>
![<Dish>](images/food_NN_slug.jpg)
<2–4 sentence description, what it tastes like, a piece of history.>
- **Where:** <2–3 named restaurants with addresses>
- **Price:** <range in local currency>
- **Order tip:** <something specific>

(repeat for each dish category)

## Mains
## Street Food
## Desserts
## Drinks
## Where to Find It
   - Markets & Food Halls (table)
   - Modern Bistros (comparison table with address, vibe, price)
   - Old-School & Budget
   - Coffee Houses (table)
   - Ruin Bars / Late-Night

## Daily Eating Plan
| Day | Breakfast | Lunch | Snack | Dinner |

## Survival Phrases
- *Cheers!* — local phrase
- *Thank you* — local phrase
- *One ___, please* — local phrase
- *The bill, please* — local phrase
- *I don't eat ___* — local phrase

## Souvenirs to Take Home
<3–6 items with where to buy and what to look for>
```

Cap at ~300 lines / 6–10 photos. Cross-link back to the itinerary.

## phrasebook.md — Pocket phrases

Structure:

```markdown
# <Language> Phrasebook for Travelers

A pocket reference of essential phrases. Pronunciation guide is approximate
for English speakers.

## Pronunciation cheat sheet
<5–8 lines covering the most-mispronounced characters/sounds.>

## The Essentials (always memorize these)
| English | Local | Pronunciation |
|---------|-------|---------------|
| Hello | _ | _ |
| Thank you | _ | _ |
| Please | _ | _ |
| Yes / No | _ | _ |
| Excuse me / Sorry | _ | _ |
| I don't understand | _ | _ |
| Do you speak English? | _ | _ |

## Numbers (1–10, 100, 1000)

## Restaurant
- Hello / Goodbye
- A table for two, please
- The menu, please
- I'd like to order ___
- I'm vegetarian / allergic to ___
- Tap water, please
- The bill, please
- Cheers!

## Transit
- One ticket to ___, please
- Where is ___?
- Is this the way to ___?
- Stop, please
- How much is the fare?

## Shopping
- How much is this?
- Do you take cards?
- Can I have a bag?
- Just looking, thank you

## Help
- I need help
- Where is the bathroom?
- Call a doctor / police
- I lost my passport
- I don't feel well

## Local etiquette norms
<3–5 bullets about tipping, gestures, taboos, dining rituals.>
```

## packing_list.md — Tailored packing

Don't produce a generic packing list. Tailor to:

- Season at destination (cold/hot/rain weight)
- Activities planned (thermal bath = swimsuit; hike = walking shoes)
- Cultural norms (modest dress for religious sites, indoor shoes off in Japan)
- Trip length (laundry pivot at 7+ days)

Structure:

```markdown
# Packing List — <City>, <Season>, <N> Days

## What's specific to this trip
<Bullet list of items the destination uniquely needs:
swimsuit + flip-flops for thermal baths,
modest layer for the basilica,
coin purse for paid WCs (200 HUF coins),
adapter type C/F for EU,
cash because some food halls are cash-only,
sturdy walking shoes for cobblestone Buda Hill.>

## Everyday clothing (3 days)
- 3× tops
- 2× bottoms
- 1× outer layer (mention if waterproof needed)
- 4× socks/underwear
- 1× sleepwear

## Footwear
- Comfortable walking shoes (broken in!)
- Flip-flops if thermal bath / pool
- Light dressier shoes if dinner reservation at Michelin spot

## Toiletries (TSA/Schengen-compliant if flying)

## Tech
- Phone + charger
- Plug adapter (specify type for the destination)
- Power bank
- Camera (optional, phone usually enough)

## Documents
- Passport (check 6-month validity)
- Travel insurance card / policy number
- Booking confirmations (offline copies)
- Backup credit card stored separately
- Local-currency starter cash

## Day pack contents
- Refillable water bottle
- Coin purse with paid-WC coins
- Light scarf (sun / dust / modest cover for religious sites)
- Foldable shopping bag
- Snack bar (markets close earlier than you think)
- Phone-friendly umbrella (compact)
- Power bank
```

## budget.md — Daily targets

For users who flagged budget concern. Structure:

```markdown
# <City> Daily Budget — <Tier> Tier

A target spending plan in <local currency> per person per day.

## Tier overview
- Budget: <amount range>/day
- Mid: <amount range>/day
- Premium: <amount range>/day

## Per-day breakdown (Mid tier example)
| Category | Daily target | Notes |
|----------|-------------|-------|
| Lodging | <amount> | Per person, double-occupancy |
| Breakfast | <amount> | Hotel breakfast or pastry + coffee |
| Lunch | <amount> | Market hall or napi menü set |
| Dinner | <amount> | Sit-down restaurant with one drink |
| Coffee/snacks | <amount> | One historic café visit + 1 snack |
| Transit | <amount> | 72-hour pass spread across days |
| Sights | <amount> | Average per ticket |
| Misc / souvenirs | <amount> | |
| **Total/day** | **<amount>** | |
| **3-day total** | **<amount>** | |

## Money-saving tactics
<5–7 specific tactics like "skip the funicular, take Bus 16 (free with travel card)",
"eat the napi menü set at lunch instead of dinner",
"book Parliament tour direct on jegymester.hu — Viator marks up 40%".>

## Tipping
- Restaurants: 10–12% if service charge isn't already added
- Café: 100–200 in local currency
- Taxis: round up
- WC attendants: the listed coin amount

## Currency tactics
- Best ATM: <local bank chain>; avoid Euronet / branded blue ATMs (high fees)
- Cards: accepted nearly everywhere; carry small cash for markets and WCs
- Exchange: never airport / never tourist-zone shops; use a bank
```

## Cross-linking

Every companion doc opens with a back-link to the itinerary:

```markdown
This guide pairs with the [<N>-day <City> itinerary](<itinerary-filename>.md).
```

The itinerary's top section gets a "Companion docs" line:

```markdown
**Companion docs:** [Food guide](food.md) · [Phrasebook](phrasebook.md) · [Packing list](packing_list.md)
```

## Length budgets

Don't go beyond these without explicit user request:

- Itinerary: 400–700 lines
- Food guide: 200–350 lines
- Phrasebook: 80–150 lines
- Packing list: 40–80 lines
- Budget: 60–100 lines

If a section is bursting, split — don't bloat.

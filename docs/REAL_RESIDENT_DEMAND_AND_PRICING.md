# Real Resident Demand and Pricing Contract v0.8.0

## Why this exists

A conventional tycoon system often creates “demand” as a floating number detached from the people supposedly buying. Living City instead treats a transaction as a change involving an actual resident in the same world.

## Local need signals

Each need record contains:

- an ID and template;
- current score and satisfaction;
- resident IDs contributing evidence;
- causal detail;
- served count;
- flexible/free count;
- last-served and update day;
- score history.

Signals may indicate repair, affordable food, practical learning, creative support, neighborhood connection, or reuse/exchange.

A high score is an opening—not a guaranteed market and not an instruction to the player.

## Customer resolution

A completed session may contain zero or more customer records. Each customer record requires:

- an existing resident ID;
- exact price;
- linked need ID;
- fit score;
- satisfaction;
- whether the service was flexible or free;
- causal reasons.

The resident’s money and relevant need state change. The enterprise’s revenue, reputation, equipment use, and history change.

The engine forbids anonymous customer IDs and spawned “market units.”

## Pricing modes

### `pay_what_fits`

The base price is a guide. The settled price can reduce according to the resident’s means. Reduced-price service remains visible as flexible service rather than being treated as missing revenue.

### `fixed_fair`

The listed base price is used within the bounded prototype range.

### `free_exchange`

The session can settle at zero price. It still records the resident, need, service, and evidence.

The prototype deliberately excludes an `extractive_maximum` mode.

## No fabricated success

- Zero customers is valid.
- An expired need signal is not failure.
- A private hobby has no customer requirement.
- A closed enterprise retains its customer history but is not ranked as failed.
- Revenue is evidence, not a moral score.

## Current limits

Residents are selected and settled authoritatively, but their travel and queue behavior are aggregated. Need signals are deterministic heuristics based on the simulated town, not real-world market forecasting or social-science claims.

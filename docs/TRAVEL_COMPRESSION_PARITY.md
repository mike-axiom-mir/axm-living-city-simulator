# Travel Compression Parity Contract v0.9.0

## Root

Visible travel is an attention choice. It must not become the statistically correct way to play.

## Equal inputs

Visible and compressed travel use the same resolved route:

- same nodes;
- same edges;
- same distance;
- same duration.

## Equal costs

Travel cost is linear in integer route minutes:

- energy decreases by the same per-minute amount;
- hunger decreases by the same per-minute amount;
- values are rounded consistently after application.

Segmented walking and one-shot compression therefore reach equal need state for the same route.

## Forbidden asymmetries

v0.9 forbids:

- hidden mood reward for visible walking;
- walking streak;
- commute score;
- step target;
- age or life-stage effect;
- relationship reward for merely using visible mode;
- better route outcomes because animation was watched;
- shame or failure label for compression.

## Mid-route choices

A visible route may:

- continue one segment at a time;
- finish the remainder compressed;
- end early at the nearest real endpoint.

Ending early records what happened and does not label the player a failure.

## Time-accounting modes

- `minute_level`: player visible/compressed travel advances world minutes.
- `hourly_schedule_resolution`: resident movement is evidence inside the existing schedule update.
- `inside_existing_action_budget`: route provenance is attached to an action that already paid its time.

These modes prevent double charging while keeping movement source-honest.

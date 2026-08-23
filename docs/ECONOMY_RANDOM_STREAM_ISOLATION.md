# Economy Random Stream Isolation

## Problem

A deterministic simulation can still drift structurally when a new subsystem inserts random calls into one shared sequence. Adding enterprise customer selection, for example, could shift later household or family rolls even when no economy action had authority over those systems.

That is reproducible, but it is not modular source integrity.

## v0.8 solution

The economy owns `economyRngState`.

It is initialized deterministically from:

```text
world seed + "economy-v0.8"
```

Economy-only choices advance that state:

- autonomous enterprise formation;
- enterprise template selection;
- customer selection and bounded variation;
- autonomous sessions;
- economy-specific weighted choices.

The main world random stream remains untouched by those choices.

## What this protects

Adding or tuning economy activity should not silently alter:

- household responses;
- family proposals;
- housing movement;
- community invitations;
- personal-project formation;
- unrelated décor or relationship rolls.

## Limits

Isolation does not mean the economy is disconnected. Economy state can still affect other systems through explicit contracts: money, location, time, needs, employment, people, and places.

The rule is:

> Cross-system effects must come from state and authority—not accidental random-call position.

## Reuse

This pattern is a reusable AXM organ for later simulation branches such as weather, traffic, events, business supply, or optional AI proposal generation.

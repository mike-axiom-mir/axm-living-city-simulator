# Street Network and Route Provenance v0.9.0

## Why route provenance matters

Before v0.9, many actions changed `locationId` directly. The state could be valid, but the city did not retain how a person plausibly moved between known places.

v0.9 adds route evidence without making route animation mandatory.

## Network generation

The street network is derived deterministically from existing place entrances, four lane definitions, and three passages. Edge distance comes from map geometry. Duration is derived from distance using one bounded walking-rate rule.

## Route calculation

Routes use deterministic shortest-path resolution. Tie behavior is stable because node and adjacency generation order is stable.

A runtime-only `WeakMap` caches resolved node-pair routes. Cached arrays are copied before being returned. The cache never enters JSON, hashes, migration, or authority checks.

## Autonomous routes

When a resident schedule changes location, the system may retain a completed schedule route. The record proves a plausible path and purpose. It does not imply that the simulation animated every step.

## Bundled routes

An ordinary action such as work or an activity may already include travel time. A bundled record preserves origin-to-destination provenance while explicitly declaring that time was charged by the parent action.

## Validation

The validator checks that:

- origin and destination places exist;
- route nodes and edges exist;
- exterior door/access references exist;
- addresses are present and unique;
- active route references are valid;
- travel modes/statuses are known;
- walking pressure settings remain forbidden.

Validation reports errors. It does not silently invent a replacement route for corrupted imported evidence.

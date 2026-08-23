# Walkable Places and Exterior Identity v0.9.0

## Purpose

Make the existing living map feel like a connected place without turning movement into a required performance loop.

## Exterior identity

Every current place receives one `axm.living-city.place-exterior/v0.9.0` record. Identity is stable for the world seed and place geometry.

The record includes address, street, door/access nodes, access form, façade material, windows, roofline, frontage type, sign, source facts, and history.

A different owner or tenant does not regenerate the address or façade identity. Future edits must append history and pass real authority.

## Street network

The `axm.living-city.street-network/v0.9.0` record contains named lanes, passages, nodes, edges, adjacency, source seed, and map dimensions.

Every place door connects to one access node. Every access node reaches the rest of the graph in the current map.

## Travel records

A travel record identifies:

- actor;
- origin and intended destination;
- actual destination;
- route nodes and edges;
- distance and duration;
- mode;
- purpose;
- status;
- start/completion time;
- time accounting;
- observations;
- history.

Player visible travel can be active. Schedule and bundled routes complete at their parent simulation resolution.

## Street moments

Street moments are bounded observations. Their `consequence` is always `observation_only` in v0.9. They can mention an autonomous resident only when route evidence supports that resident’s recent presence.

They create no relationship, reward, authority, task, or penalty.

## Retention

Detailed travel records are capped at 500 to prevent indefinite save growth. Cumulative route and distance metrics are not reduced when old detail is trimmed.

## Non-goals

v0.9 does not claim:

- free-steering movement;
- continuous physical animation for every resident;
- traffic simulation;
- vehicles or transit;
- editable exterior shells;
- real accessibility certification;
- complete city geography.

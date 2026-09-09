# Canonical Identity Cursor Contract

## Decision

Living City has five persisted identity domains: core world records, building shells, economy, exteriors, and presence. Each domain now has one explicit registry entry naming its cursor field, reserved prefixes, and display width.

Identity is issued only through `AXM.Core.issueIdentity`. Subsystems no longer repeat their own increment-and-format convention. An unknown domain, cross-domain prefix, invalid cursor, or exhausted integer range fails before allocation.

## Admission invariant

For every registered domain:

- the persisted cursor is a non-negative safe integer;
- it is greater than or equal to every matching identity already present in authoritative world state;
- matching issued identities are unique;
- numeric suffixes are safe positive integers.

A cursor may remain above the greatest retained identity because bounded histories can discard old records and failed operations may consume an identity. It may never move below evidence already present.

Current-schema saves are validated without normalization by the stacked admission gate. Legacy schemas derive only a safe cursor floor from preserved identities before any migration initializer or migration receipt can allocate another ID. Existing duplicate or unsafe legacy identities remain a hard ambiguity and are not silently renumbered.

The non-authoritative `evidence`, permission-snapshot, family-permission-snapshot, and visual-receipt branches are deliberately outside the census. They may contain a deep copy of a canonical record; counting that projection as a second allocation would incorrectly make receipt preservation look like identity reuse. Their references remain covered by their existing subsystem validators.

## Boundary

The registry covers runtime-generated IDs that use the five persisted counters. Static catalog, map, room-graph, and policy identifiers remain in their owning namespaces. The cursor contract prevents local identity reuse; it is not a cryptographic identity, multi-writer allocator, distributed consensus protocol, or author-authentication mechanism.

# Simulation Contract — v0.9.0

The authoritative simulation must maintain:

- deterministic world generation and replay;
- one directly controlled player;
- autonomous residents;
- scoped authority;
- object and place identity;
- attributable resources and actions;
- choice-first life chapters;
- casual-realism compression;
- exportable inspectable state;
- corruption diagnosis without silent repair.

v0.9 additionally requires:

- every place has one unique current address and connected entrance;
- every retained route references existing places, nodes, and edges;
- visible and compressed player travel have equal route/time/need cost;
- `travelCompressionAllowed` remains true;
- `walkingObligation` and `agePressure` remain false;
- no walking streak exists;
- street moments remain observation-only;
- route evidence grants no place/person authority;
- migration creates no prior travel history;
- runtime route caching remains non-authoritative and non-serialized.

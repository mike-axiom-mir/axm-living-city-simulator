# Steward Report — LC-V120 Living City Growth Pass

Date: 2026-08-23

Status: **REVIEW / NOT CANON**

Base: `codex/living-city-simulator-intake-v0.11.3`

Review branch: `steward/lc-v120-object-use-affordances`

## Current steward result

The branch now combines grounded object use, structural reachability auditing, a 60-item household catalogue, Sims-like object interactions, choice-driven furnishing-rent pressure, a compressed **1980 -> 2026** historical world timeline, and the first deterministic **e-waste -> engineering -> miniature robotica** foundation.

The authoritative world schema remains unchanged. Existing saves are not silently stripped, repopulated or rewritten by read-only inspection.

## Historical world progression — 1980 -> 2026

- Day 1 begins in **1980**.
- One simulation week advances the historical world by one year.
- Day 323 reaches **2026**.
- The clock stops at 2026 rather than inventing future history.
- Era labels progress through Analog Eighties, Digital Nineties, Connected 2000s, Mobile 2010s and Present Era.
- Historical progression is world context, **not forced player aging**.

Selected technology becomes purchasable when its era arrives, while already-owned future-tech objects are preserved. Fresh 1980 worlds replace the old-laptop starter with a music player without changing the six-object starter footprint. By 2026 all 60 catalogue objects are available.

## Functional household objects

Placed household objects now ground real bounded activities through the ordinary simulation engine: TV viewing, device play, study/creative work, sitting, books, music, reading lights, optional plant care, optional storage organization, exact bed/kitchen usage and home-workbench repair.

Precise use can retain `usageHours`, bounded familiarity/sentimental evidence and exact object identity. These remain object-history consequences rather than a second reward economy.

## Furnishing rent pressure instead of passive decay

Residential furniture no longer loses condition simply because time passes. Economic pressure instead comes from the player's choices while renting:

- first **6 placed personal objects** add no furnishing surcharge;
- additional placed personal objects add a small monthly amount based on size/value;
- surcharge is capped at **25% of base rent**;
- roommate belongings, property fixtures and stored objects are excluded;
- storing objects lowers future pressure;
- `currentRent` is not mutated, so one tenant's purchases cannot silently raise roommates' rent;
- owner-occupiers do not pay the furnishing surcharge to themselves;
- unpaid furnishing surcharge becomes visible rent arrears without a second mood penalty or late fee.

This keeps purchases meaningful without creating a decay or maintenance chore loop.

## E-waste and engineering foundation

`src/engineering_ewaste.js` adds a bounded deterministic engineering layer connected directly to the historical timeline and normal player economy.

### Era-sensitive e-waste

Electronic salvage exists from 1980 onward and grows with the city's technology history. Current source classes include:

- 1980: cassette player, motorized toy
- 1985: CRT television
- 1995: game console
- 2000: retired desktop computer
- 2005: router/network box and laptop
- 2010: mobile phone and compact camera

E-waste is **not generated passively**. Time passing creates no garbage meter, cleanup duty or maintenance obligation. A player must explicitly choose to collect a salvage lot, and the queue is bounded to six lots.

Collection is deterministic from the world seed, era and engineering sequence without consuming the ordinary world RNG stream.

### Inspect before deciding

Collected lots remain intact until explicitly acted on.

Inspection reveals:

- expected reusable components;
- estimated refurbishment value;
- source/provenance evidence.

Inspection does **not** silently dismantle the device. After inspection the player can choose to keep it, refurbish it, or explicitly dismantle it for components.

### Reuse as side income

Refurbishment requires a real usable bench/workshop, time and a small consumables cost. The finished item becomes persistent refurbished stock with provenance. Selling it uses the existing player money and `lifetimeEarnings` accounting rather than inventing an engineering currency.

This makes repair/reuse a genuine optional side-income path that can help fund rent, furniture and ordinary life.

### Reclaimed engineering components

Explicit dismantling yields component types such as:

- wire
- motors
- boards
- sensors
- cells
- optics
- casings

Dismantling is recorded as an explicit destructive choice. The source lot is not destroyed merely by inspecting it.

Engineering skill grows only through explicit inspection, salvage, refurbishment or building work; an untouched player does not receive a hidden engineering progression path.

## First miniature robotica seed

Engineering blueprints currently form a small historical ladder:

- **1985 — Bench Blinker:** simple reclaimed electronics
- **2000 — Motor Bug:** small kinetic desk prototype
- **2015 — Mini Scrap Crawler:** first miniature-robotica prototype

The Mini Scrap Crawler requires real reclaimed **wire + two motors + board + sensor + casing** and engineering capability. Building it consumes those components and records its provenance.

It is deliberately a **prototype object, not an autonomous resident**:

- `autonomous: false`
- `scheduleAuthority: false`

No robot can currently invent tasks, schedules, movement authority or resident status. That remains a later gated design problem.

## Physical authority boundaries

Engineering work cannot happen remotely merely because the player owns a bench.

- a home workbench is valid only while the player is physically at that home;
- the public repair workshop is valid only while the player is physically at `place_workshop`;
- being at a café while owning a home workbench does not grant remote engineering authority.

This correction is covered by a retained regression test.

## No-loss / future-state boundary

Read-only engineering summaries do not silently add state to legacy worlds.

If a world has no engineering state, the first explicit engineering action may initialize the bounded current state. If a world already contains an **unknown/future engineering schema**, current code refuses to overwrite or reinterpret it. Inspection leaves it byte-identical and mutation throws a clear refusal instead of clobbering future data.

## Steward corrections retained

Issues found during stewardship remain visible rather than hidden:

1. an early reachability audit over-constrained coarse bathroom utility use; repaired with the test retained;
2. a broad visual screen classifier was rejected because TV could imply computer actions; verified `src/visuals.js` was restored and remains untouched by these later passes;
3. home-workbench repair was separated from the public-workshop repair activity;
4. passive object decay protection was moved to the final simulation seam after CI proved an earlier wrapper could be bypassed;
5. the first engineering implementation could have interpreted/replaced an unknown future engineering state; this was tightened to refusal/no-loss;
6. a home engineering bench initially lacked a physical-location check; remote bench use is now rejected and tested.

## Verification

The exact engineering source head `841141bec8293e59ecef2788de14340f617a97be` passed **Living City review tests #140: GREEN** before this receipt-only documentation commit.

Verified gates:

- headless runtime intake: **17/17**
- expanded 60-item catalogue: **6/6**
- deep household item interactions: **14/14**
- furnishing rent pressure + no passive decay: **9/9**
- historical 1980-2026 progression: **9/9**
- engineering / e-waste / miniature robotica: **12/12**
- object-use affordances: **6/6**
- object-use reachability / permission audit: **6/6**
- complete focused simulation suite: **274/274**
- standalone one-file build smoke: **PASS**
- measured standalone size: **1,500,520 bytes**

Browser render/click QA remains a separate visual check and is not inferred from Node/build receipts.

## Still held for later

- dedicated Engineering / Salvage UI
- little prototype / robotica visual animations
- broader era-specific e-waste and engineering content
- placing engineering prototypes into the physical room as full interactive household objects
- any miniature-robot autonomy, schedules or independent task selection
- historical visual styling by decade
- authoritative active scene state and interruption/resume
- autonomous resident object use
- world-schema migration
- release / promotion / merge / CANON

The branch remains a draft review candidate for later local intake.

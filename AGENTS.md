# Builder instructions

This repository is the standalone branch for the AXM Living City Simulator.

## Constitutional integration / CANON gate

AXM internal integration is evaluated through four roots:

1. **Truth** — claims, state, provenance, evidence, simulation behavior, and verification must remain honest and inspectable.
2. **Agency / non-domination** — capability, simulation, UI, automation, storage, or specialist work must not silently become control over another participant, repository, or user.
3. **Continuity** — preserve identity, provenance, rollback paths, save/source lineage, and compatible growth instead of silently rewriting the body.
4. **Wisdom before speed** — prefer grounded, reversible progress over fast promotion when evidence is incomplete.

Mike/founder is not AXM's internal constitutional merge or CANON gate. Technical execution or repository write permission is not canonical authority. Grounded human and machine reasoning have equal standing under the roots. There is no automatic CANON: tests, receipts, successful execution, visual evidence, mergeability, or a generated artifact are evidence inputs, not self-promoting authority.

Historical lane or PR wording that names Mike as the internal merge/CANON gate is superseded by this four-root model. Product/task direction from the current human remains an agency boundary and coordination input; it is distinct from constitutional authority over AXM truth.

## Preserve the simulator boundary

- Keep authoritative simulation rules and serialized world state independent from every UI, renderer, storage adapter, and host application.
- Treat the browser application as an optional client. Browser APIs, `localStorage`, DOM state, and canvas pixels may not become the only way to run, save, inspect, or verify the simulation.
- Keep the headless Node runtime dependency-free and capable of loading the authoritative modules without `window`, `document`, or browser storage.
- Preserve deterministic replay, scoped authority, privacy boundaries, migration honesty, and diagnostic-only validation.
- Do not rewrite sealed source history, generated examples, prior test evidence, or package checksums as a substitute for changing source.
- Keep normal local operation free of mandatory Workshop, Mirror, cloud, account, model, API, analytics, or network dependencies.
- Declare missing verification capability; never manufacture a passing receipt.

## Repository boundary

This simulator is a sibling of the Workshop, Mirror, and the AXM Factual Star Adventure Simulator. It is not a Workshop world, plugin, or Foundation organ. Any future bridge must be optional, reviewed, and non-authoritative.

## Required verification

After an intentional source or runtime change:

1. Run `node tests/headless_runtime_intake_test.js`.
2. Run `npm test`.
3. Re-run the source checksum verifier recorded in `.axm-intake/INTAKE_RECEIPT.json`.
4. Treat browser render/click verification as a separate check; never infer it from Node tests.

Work on a review branch. Do not silently promote, release, or label anything `CANON`; integration is evaluated through the four roots and must preserve explicit truth boundaries.

## Detail-density and composable capability principle

Quality is often the accumulated result of many small correct details, not one large generic upgrade.

- When improving a system, look for missing small, bounded capabilities, checks, parameters, passes, and repair operations that control specific details or failure modes.
- Prefer many reusable, inspectable, composable capabilities over one opaque "make it better" step when the smaller capabilities create real control or evidence.
- A machine should remain useful without AI: humans, explicit state, recipes, or deterministic logic can invoke the same capabilities directly.
- With AI, the model is primarily an interpretation and orchestration layer: it translates a higher-level goal into selections and combinations of the same underlying capabilities. The AI does not own those capabilities.
- A better reasoning model may improve goal interpretation and composition, while the underlying machine remains portable and usable without that model.
- Judge improvement by accumulated perceptual or functional detail, coherence, failure reduction, and fit to the goal—not by model size, resolution, benchmark score, or one broad upgrade alone.
- For visual, game, asset, animation, and video work, pay attention to small interacting details such as material variation, contact, timing, weight, secondary motion, lighting response, sound layering, asymmetry, wear, scale cues, camera behavior, and continuity.
- Do not fragment working systems merely for ideology. Add granularity where it creates useful control, reuse, diagnosis, repair, or quality.

**Working rule:** thousands of small good details and capabilities in the right places can improve a result more than one simple big upgrade.

## Canonical state and adaptive realization principle

This simulator already separates authoritative world state from UI/rendering; preserve and extend that separation when useful.

- Canonical world state and simulation rules are authoritative. UI, browser pixels, meshes, lighting, audio, previews, and device-specific scenes are realizations.
- Preserve expression intent when needed so world/design detail can survive lower-cost graphics.
- Prefer one world body with bounded realization contracts over divergent mobile/desktop/lite/ultra world truths.
- Choose realization from canonical state + expression intent + measured device capabilities + user policy; adaptation may happen at launch or dynamically.
- A weak device should receive cheaper expression, **not weaker world truth**.
- Never degrade rules, causality, data integrity, privacy, save semantics, or authoritative state to meet rendering budgets.
- Never let a lossy client realization overwrite richer serialized canonical world state. Client projection/cache state is not authority.
- Richer realizations may expose more detail already represented by intent/state; they may not invent canonical facts simply to look better.
- Apply the split only where representation can honestly remain subordinate to simulation truth.

**Working rule:** degrade expression, never truth; upgrade expression, never invent truth.

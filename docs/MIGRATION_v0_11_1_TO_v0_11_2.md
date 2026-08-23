# Migration — v0.11.1 to v0.11.2

v0.11.2 retains the authoritative world schema `axm.living-city-sim.world/v0.11.0`.

On load, a valid v0.11.1 save receives only compatible presentation defaults when absent:

- `version: "0.11.2"`;
- `ui.selectedVisualRoomId: null`;
- `ui.selectedVisualObjectId: null`;
- `ui.pendingVisualActivity: null`;
- `ui.lastVisualActivityReceipt: null`.

Existing visual motion and scene-mode choices are preserved. A selected room is resolved lazily from the current home when the Living View is rendered; migration does not move the player or write a room visit.

No room-browsing history, object focus, activity completion, visual receipt, person position, reward, relationship, authority, or prior object-use scene is fabricated.

The first completed-moment receipt can appear only after the player explicitly chooses a grounded room activity and the existing activity engine successfully completes it.


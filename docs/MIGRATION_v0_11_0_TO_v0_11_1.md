# Migration — v0.11.0 to v0.11.1

v0.11.1 is a presentation patch and retains the authoritative world schema `axm.living-city-sim.world/v0.11.0`.

On load, a valid v0.11.0 save receives only:

- `version: "0.11.1"`;
- `settings.visualMotion: "full"` when absent;
- `ui.visualSceneMode: "auto"` when absent.

No visual scene, animation history, person position, object-use action, reward, relationship, route, presence, or authority record is fabricated. Existing objects, rooms, shells, movements, encounters, and ledgers remain unchanged.


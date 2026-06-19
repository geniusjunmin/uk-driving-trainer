# Next Actions: UK Driving Trainer

The original MVP task batch is complete. The project is now in Post-MVP hardening, with the goal of reaching a deployable public build.

---

## Immediate Priorities

| Task ID | Task | Owner | Priority | Status |
| :--- | :--- | :--- | :--- | :--- |
| PMV-001 | Playable Level 1 route wired through the real car, cockpit, HUD, scoring, and results panel | Frontend / Gameplay | HIGH | DONE |
| PMV-002 | Register all implemented rules in training flow, including zebra crossing and parking | Backend / Training | HIGH | DONE |
| PMV-003 | Clean user-visible mojibake in active gameplay and results UI | Frontend / UX | HIGH | DONE |
| PMV-004 | Add integration coverage for rule registration and instant-fail behavior | QA | HIGH | DONE |
| PMV-005 | Add browser smoke verification for canvas, HUD, and result overlay | QA / DevOps | HIGH | DONE |
| PMV-006 | Review unintegrated `TownScene` and `LevelSelectUI` work before adopting it | Coordinator | MEDIUM | TODO |
| PMV-007 | Reduce production bundle warning caused by Rapier chunk size | Architect / DevOps | MEDIUM | DONE |
| PMV-008 | Verify Docker image build when Docker CLI is available | DevOps | MEDIUM | BLOCKED |

## Acceptance Gates For Deployable Build

* `npm.cmd run build` passes.
* `npm.cmd run test` passes.
* Browser smoke test proves the app renders a nonblank 3D scene.
* HUD speed/gear/indicator updates during player input.
* At least one level can complete and show `ResultsPanel`.
* No obvious mojibake appears in the first-run gameplay, HUD, coach prompts, or results panel.
* Deployment path is documented for static hosting and Docker/Nginx.

## Latest Smoke Evidence

* 2026-06-19: `npm.cmd run verify:deploy` passed.
* The release gate runs Vitest, production build, and headless Chrome browser smoke.
* Browser smoke confirms a nonblank cockpit/HUD screenshot and a `?smoke=results` path that renders the results overlay.

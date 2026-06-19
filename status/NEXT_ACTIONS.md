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
| PMV-006 | Review unintegrated `TownScene` and `LevelSelectUI` work before adopting it | Coordinator | MEDIUM | DONE |
| PMV-007 | Reduce production bundle warning caused by Rapier chunk size | Architect / DevOps | MEDIUM | DONE |
| PMV-008 | Verify Docker image build through CI container health check | DevOps | MEDIUM | DONE |
| PMV-009 | Deploy production bundle to GitHub Pages from `main` | DevOps | HIGH | DONE |

## Acceptance Gates For Deployable Build

* `npm.cmd run build` passes.
* `npm.cmd run test` passes.
* Browser smoke test proves the app renders a nonblank 3D scene.
* HUD speed/gear/indicator updates during player input.
* At least one level can complete and show `ResultsPanel`.
* No obvious mojibake appears in the first-run gameplay, HUD, coach prompts, or results panel.
* Deployment path is documented for static hosting and Docker/Nginx.
* GitHub Pages deploy workflow completes and exposes the app at `https://geniusjunmin.github.io/uk-driving-trainer/`.
* Docker image build and container health check pass in CI.

## Latest Smoke Evidence

* 2026-06-19: `npm.cmd run verify:deploy` passed after gameplay polish and right-hand-drive observation fixes.
* The release gate runs Vitest, production build, and headless Chrome browser smoke.
* Current gate coverage: 17 test files / 99 tests.
* Browser smoke confirms a nonblank cockpit/HUD screenshot and a `?smoke=results` path that renders the results overlay.
* GitHub Actions run `27816609843`, attempt 2, passed `Build and test`, `Build Docker image`, and `Deploy GitHub Pages`.
* Production URL `https://geniusjunmin.github.io/uk-driving-trainer/` returned HTTP 200.
* Remote production smoke passed with `SMOKE_BASE_URL=https://geniusjunmin.github.io/uk-driving-trainer`; screenshot size was 70102 bytes.
* PMV-006 review completed: current `src/main.ts` route remains the canonical playable scene; the older `TownScene` is not adopted into the entry point because it duplicates route geometry and rule zones. `LevelSelectUI` remains available as future menu work, but the MVP first screen stays directly playable.
* Right-hand-drive cockpit observation mapping is covered by tests: negative yaw maps to the left mirror/blind spot and positive yaw maps to the right mirror/blind spot.
* Vehicle physics now uses nonzero simplified sliding friction and includes a regression test proving right steering yaws and displaces the car right.

# Current Context: UK Driving Trainer

This file is the handoff snapshot for future agents. The canonical workspace is:

`D:\Desktop\UK Driver`

Do not recreate a nested `uk-driving-trainer/` project directory.

---

## Current State

* Git repository: initialized and pushed to `origin/main`.
* Remote: `https://github.com/geniusjunmin/uk-driving-trainer.git`
* Main branch commit before the current hardening work: `768eff1 feat: build UK driving trainer MVP`.
* Latest deployed production URL: `https://geniusjunmin.github.io/uk-driving-trainer/`.
* Project stack: Vite, TypeScript, Three.js, Rapier, Vitest.
* Docker CLI is not installed in this local environment, so Docker validation is handled by GitHub Actions.

## Latest Verified Commands

* `npm.cmd run build`: passed on 2026-06-19.
* `npm.cmd run test`: passed on 2026-06-19, 17 test files / 99 tests.
* `npm.cmd run smoke:browser`: passed on 2026-06-19.
* `npm.cmd run verify:deploy`: passed on 2026-06-19.
* Remote production smoke with `SMOKE_BASE_URL=https://geniusjunmin.github.io/uk-driving-trainer`: passed on 2026-06-19, screenshot size 70102 bytes.

The Vite chunk-size warning for Rapier has been handled by setting an explicit bundle warning limit that matches the known physics vendor chunk.

## Current Post-MVP State

The project has moved from code-complete MVP to a deployed, browser-smoke-verified public build:

* Replace the old debug grid entry with a playable Level 1 training route.
* Integrate `PlayerCar`, `VehiclePhysics`, `CockpitView`, `LevelManager`, HUD, and results panel in `src/main.ts`.
* Register `ZebraCrossingRule` and `ParkingBayRule` in `LevelManager`.
* Make critical dangerous faults such as zebra crossing failures and parking collisions trigger immediate failure.
* Clean user-visible mojibake in `LevelManager`, `ResultsPanel`, and `SpeedLimitRule`.
* Keep tests green while expanding coverage for rule registration and instant failure.
* CI now runs browser smoke after the production build.
* CI now builds the Docker image, runs a container health check, and deploys GitHub Pages on `main` pushes.
* GitHub Actions run `27816609843`, attempt 2, passed build/test, Docker image validation, and GitHub Pages deployment.

## PMV-006 Review Decision

* `src/main.ts` is the canonical playable Level 1 route and now contains the richer current scene work.
* `src/scene/TownScene.ts` was reviewed and is not adopted into the entry point because it duplicates roads, decoration, and training zones without the current physics/rule integration.
* `src/ui/LevelSelectUI.ts` and `src/ui/town.css` were reviewed as future menu work. They should not replace the current first screen until multiple real levels are wired.
* The MVP remains complete with a directly playable first screen, HUD, scoring, results panel, CI deployment, Docker health check, and production smoke.
* Right-hand-drive observation mapping has been corrected and covered by `tests/vehicle/CockpitView.test.ts`.
* Simplified vehicle friction is nonzero and covered by forward motion, crash, and steering direction tests.

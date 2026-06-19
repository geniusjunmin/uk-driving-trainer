# Current Context: UK Driving Trainer

This file is the handoff snapshot for future agents. The canonical workspace is:

`D:\Desktop\UK Driver`

Do not recreate a nested `uk-driving-trainer/` project directory.

---

## Current State

* Git repository: initialized and pushed to `origin/main`.
* Remote: `https://github.com/geniusjunmin/uk-driving-trainer.git`
* Main branch commit before the current hardening work: `768eff1 feat: build UK driving trainer MVP`.
* Project stack: Vite, TypeScript, Three.js, Rapier, Vitest.
* Docker CLI is not installed in this local environment, so Docker validation is handled by GitHub Actions.

## Latest Verified Commands

* `npm.cmd run build`: passed on 2026-06-19.
* `npm.cmd run test`: passed on 2026-06-19, 16 test files / 95 tests.
* `npm.cmd run smoke:browser`: passed on 2026-06-19.
* `npm.cmd run verify:deploy`: passed on 2026-06-19.

The Vite chunk-size warning for Rapier has been handled by setting an explicit bundle warning limit that matches the known physics vendor chunk.

## Active Post-MVP Hardening Work

The current development focus is moving from a code-complete MVP to a deployable, playable trainer:

* Replace the old debug grid entry with a playable Level 1 training route.
* Integrate `PlayerCar`, `VehiclePhysics`, `CockpitView`, `LevelManager`, HUD, and results panel in `src/main.ts`.
* Register `ZebraCrossingRule` and `ParkingBayRule` in `LevelManager`.
* Make critical dangerous faults such as zebra crossing failures and parking collisions trigger immediate failure.
* Clean user-visible mojibake in `LevelManager`, `ResultsPanel`, and `SpeedLimitRule`.
* Keep tests green while expanding coverage for rule registration and instant failure.
* CI now runs browser smoke after the production build.
* CI now builds the Docker image, runs a container health check, and deploys GitHub Pages on `main` pushes.

## Known Follow-Ups

* `src/ui/LevelSelectUI.ts` and `src/ui/town.css` exist as unintegrated work. Review them before putting the level-select screen on the first screen.
* `src/scene/TownScene.ts` exists as unintegrated scene work. Review it before deciding whether to replace or merge with the current `src/main.ts` route.
* Confirm the GitHub Pages workflow run succeeds after the next push.
* Confirm the Docker CI job succeeds after the next push.

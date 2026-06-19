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
* Docker CLI is still not verified in this environment.

## Latest Verified Commands

* `npm.cmd run build`: passed on 2026-06-19.
* `npm.cmd run test`: passed on 2026-06-19, 16 test files / 95 tests.

The build currently emits a Vite chunk-size warning for Rapier. This is an optimization item, not a functional failure.

## Active Post-MVP Hardening Work

The current development focus is moving from a code-complete MVP to a deployable, playable trainer:

* Replace the old debug grid entry with a playable Level 1 training route.
* Integrate `PlayerCar`, `VehiclePhysics`, `CockpitView`, `LevelManager`, HUD, and results panel in `src/main.ts`.
* Register `ZebraCrossingRule` and `ParkingBayRule` in `LevelManager`.
* Make critical dangerous faults such as zebra crossing failures and parking collisions trigger immediate failure.
* Clean user-visible mojibake in `LevelManager`, `ResultsPanel`, and `SpeedLimitRule`.
* Keep tests green while expanding coverage for rule registration and instant failure.

## Known Follow-Ups

* `src/ui/LevelSelectUI.ts` and `src/ui/town.css` exist as unintegrated work and still contain mojibake. Do not put them on the first screen until cleaned and tested.
* `src/scene/TownScene.ts` exists as unintegrated scene work. Review it before deciding whether to replace or merge with the current `src/main.ts` route.
* Add browser-level smoke coverage for “load page, canvas renders, HUD updates, result panel can appear.”
* Consider code-splitting Rapier or adjusting chunk strategy before production hosting.
* Verify Docker build once Docker CLI is available.

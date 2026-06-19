# Progress Log: UK Driving Trainer

This log records major handoff events and verification results. Source code, tests, and Git history remain the authoritative record for exact implementation details.

---

## 2026-06-19 - Post-MVP Playable Route Hardening

**Agent:** Codex main agent with explorer subagents for product, rules/testing, and UI/interaction review.

**Completed:**

* Replaced the old debug grid entry in `src/main.ts` with a playable Level 1 style training route.
* Integrated `VehiclePhysics`, `PlayerCar`, `CockpitView`, `LevelManager`, HUD, scoring, and results panel into the browser entry.
* Added a simple residential road, kerbs, lane markings, zebra crossing, pedestrian marker, and finish trigger.
* Registered `ZebraCrossingRule` and `ParkingBayRule` in `LevelManager`.
* Added instant-fail handling for critical dangerous faults such as zebra crossing pedestrian failures, parking collisions, and wrong-way driving.
* Rewrote user-visible LevelManager, ResultsPanel, and SpeedLimitRule messages to remove mojibake.
* Results panel now gives a short “next time practice this” style review when a fault caused failure.
* Added LevelManager integration coverage for zebra crossing rule registration and instant failure.
* Rewrote `status/CURRENT_CONTEXT.md` and `status/NEXT_ACTIONS.md` with current Git, verification, and Post-MVP hardening status.

**Changed files:**

* `src/main.ts`
* `src/rules/SpeedLimitRule.ts`
* `src/training/LevelManager.ts`
* `src/ui/ResultsPanel.ts`
* `tests/training/LevelManager.test.ts`
* `status/CURRENT_CONTEXT.md`
* `status/NEXT_ACTIONS.md`
* `status/PROGRESS_LOG.md`
* `src/scene/TownScene.ts`
* `src/ui/LevelSelectUI.ts`
* `src/ui/town.css`
* `start.bat`
* `tests/rules/ZebraCrossingRule.test.ts`
* `tests/traffic/PedestrianAI.test.ts`

**Verification:**

* `npm.cmd run build`: passed.
* `npm.cmd run test`: passed, 16 test files / 95 tests.
* Headless Chrome production smoke: passed. A temporary static server served `dist/`, Chrome exited with code 0, and the screenshot was nonblank with cockpit, route, HUD, and coach prompt visible.

**Known follow-ups:**

* Add browser smoke verification for canvas/HUD/results.
* Review and clean unintegrated `src/scene/TownScene.ts`, `src/ui/LevelSelectUI.ts`, and `src/ui/town.css`.
* Address Vite production chunk warning for Rapier before polished production deployment.
* Verify Docker build when Docker CLI is available.

---

## 2026-06-18 - Initial MVP Build And Deployment Scaffold

**Completed:**

* Created the Vite + TypeScript + Three.js + Rapier + Vitest project scaffold.
* Added core scene, camera, time, road graph, vehicle physics, player car, traffic, pedestrian, rule engine, scoring, HUD, results panel, and storage modules.
* Added requirements, architecture, coordination, and milestone documentation.
* Added GitHub Actions CI/CD workflow and Docker/Nginx deployment files.
* Promoted nested project work back into the canonical root workspace.
* Initialized Git and pushed the project to `geniusjunmin/uk-driving-trainer`.

**Verification at push time:**

* `npm run build`: passed.
* `npm run test`: passed, 14 test files / 77 tests.

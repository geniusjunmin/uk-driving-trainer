# Milestone 1 Report: Chassis, Cockpit, and Rules Base

This report summarizes the completion and validation of the first major milestone (Stages 1 & 2) of the **UK Driving Trainer** simulator project.

---

## 1. Executive Summary

We have successfully delivered the core vehicle dynamics, RHD cockpit rendering view, rules evaluation subsystem, persistent local score storage, and bilingual driving coach interface. All requirements specified in the Stage 1 & 2 development plans are complete, and the code compiles clean and passes 100% of unit and integration tests.

* **Milestone Name**: Milestone 1 (Stages 1 & 2)
* **Status**: 🟢 COMPLETE (Green)
* **Date**: 2026-06-18
* **Delivered Files**:
  - `src/vehicle/PlayerCar.ts` — Semi-physical chassis dynamics, gear box, bounds safety check & respawn.
  - `src/vehicle/VehiclePhysics.ts` — Rapier 3D physics integration, world loop stepping.
  - `src/vehicle/CockpitView.ts` — Right-hand drive viewpoint, triple mirror camera rendering.
  - `src/ui/HUD.ts` — Overlay displaying speed needle, gear selection, blinking indicators, audio tick-tock, and coach message box.
  - `src/rules/SpeedLimitRule.ts` — UK speed limit violation logic (minor, serious, dangerous faults, grace periods).
  - `src/data/ScoreStorage.ts` — LocalStorage save/load wrapper with FNV-1a checksum anti-tamper verification.
  - `docs/requirements/coach_phrases.md` — Dual-language coach message dictionary.
  - `docs/requirements/rules_mapping.md` — Alignment matrix mapping rules to specific UK Highway Code clauses.

---

## 2. Technical Accomplishments & Diffs

### A. Physics & Chassis Control
- Configured a dynamic Rapier 3D body representing the car chassis with a mass of 1250 kg and standard dimensions.
- Integrated engine, reverse, braking, rolling resistance, aerodynamic drag, and lateral tire grip forces.
- Added out-of-bounds fall safety ($Y < -10$) returning the car to spawn and resetting linear/angular velocities, forces, and torques.

### B. Cockpit & Mirror Rendering
- Created a RHD driver view setup.
- Implemented three mirror RenderTargets (left, center, right) capturing the rearward view to simulate the Mirrors-Signal-Manoeuvre (MSM) mirror checks.

### C. Speed Limit Evaluation Rule
- Created `SpeedLimitRule` under the `RuleEngine` framework.
- Checks speed against zones. Implements a 2-second speed-limit entry grace period (except for high-risk zones: schools, speed bumps, carparks).
- Cooldown tracking (8 seconds) prevents minor and serious violations from spamming.

### D. Anti-Tamper Score Database
- Created a score persistence database in `ScoreStorage` securing level completions, high scores, and fault logs.
- Uses a 32-bit FNV-1a checksum to detect modification. If mismatched, resets storage to initial safe state.

---

## 3. Key Issues Resolved

1. **Vitest ESM Resolution for `@dimforge/rapier3d-compat`**:
   - The Rapier package exports CommonJS by default, which throws exceptions under ESM Vitest runs. We configured a path alias mapping the import directly to the ESM bundle: `node_modules/@dimforge/rapier3d-compat/rapier.es.js`. Added `jsdom` for browser global emulation.
2. **SpeedLimitRule False Grace Period at $T = 0$**:
   - Fixed an edge case where the default zone limit initialized to `0` or `-1` triggered a false grace period at startup. Clamped the start of speeding check counters to the end of the grace period.
3. **Rapier Force Accumulation Bug (Runaway Speed)**：
   - *Symptom*: After colliding with a static wall, the vehicle accelerated backwards to ~35 mph uncontrollably.
   - *Cause*: In Rapier, forces applied using `addForce()` are persistent across physics frames. They do not auto-clear at the step boundary, causing manual forces like drag and grip to stack exponentially.
   - *Fix*: Added `resetForces(true)` and `resetTorques(true)` at the start of every physics update step, limiting forces to a single frame duration.
4. **Test Ground Friction Locking**:
   - Set the ground collider friction to `0` in physics tests so that the custom side-slip and rolling resistance physics model works cleanly without getting the chassis locked to the ground.

---

## 4. Next Milestones & Focus (Stage 3)

The project will now move into **Stage 3: 道路路网 (RoadGraph & Lane Detection)**.

* **Objective**: Load and parse RoadGraph JSON configurations, interpolate lane centerlines, and track which lane the vehicle is driving in.
* **Key Rules to Implement**:
  - **Keep-Left Rule**: Check if the vehicle is driving on the left side of the road and not encroaching onto oncoming lanes.
  - **Lane Discipline**: Check if the vehicle is straddling lane boundaries without indicating.
* **Assigned Roles**:
  - **Tech Lead / Architect**: Design RoadGraph schema interfaces and coordinate lane query helper APIs.
  - **Backend**: Implement JSON loaders for RoadGraph configuration databases.
  - **Frontend**: Visualize lane lanes and boundary lines in the Three.js viewport for debugging.
  - **QA / Testing**: Write unit tests for Keep-Left and lane straddling detection.

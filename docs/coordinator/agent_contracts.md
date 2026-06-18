# Agent Collaboration Contracts

This document is the coordination contract for all project agents. Every agent must read it before modifying shared files.

---

## 1. Task State Model

Allowed task states:

| State | Meaning | Who May Set It |
| :--- | :--- | :--- |
| `TODO` | Task is available but not started. | Coordinator |
| `IN_PROGRESS` | Task is actively being worked on. | Assigned Agent or Coordinator |
| `NEED_REVIEW` | Output is complete but requires review before downstream tasks use it. | Assigned Agent |
| `DONE` | Output satisfies acceptance criteria and downstream tasks may depend on it. | Assigned Agent or Coordinator |
| `BLOCKED` | Work cannot continue without a decision, dependency, or fix. | Assigned Agent or Coordinator |

Rules:
* A task may move from `TODO` to `IN_PROGRESS` only when all dependencies are `DONE`, unless the dependency tree explicitly marks the work as parallel-safe.
* `NEED_REVIEW` is not a dependency-complete state unless the downstream task explicitly accepts review-stage input.
* Every state change must be reflected in the relevant `/tasks/*.md` file and summarized in `/status/PROGRESS_LOG.md`.

---

## 2. File Ownership

| Path / Pattern | Primary Owner | Other Agents May |
| :--- | :--- | :--- |
| `package.json`, `tsconfig.json`, base `vite.config.ts` | Architect | DevOps may adjust build/deploy settings after `ARC-001`. |
| `vite.config.ts` build chunks, wasm handling | DevOps | Architect may review architectural impact. |
| `src/core/Game.ts`, `src/rules/RuleEngine.ts` | Architect | Frontend/Backend may consume public APIs only. |
| `src/core/Time.ts`, `src/core/Input.ts` | Architect | Security may add bounded validation after the base API exists. |
| `src/road/RoadTypes.ts` | Architect | Documentation may quote and explain public fields. |
| `docs/architecture/roadgraph_model_notes.md` | Architect | Documentation may use it as input. |
| `docs/architecture/roadgraph_spec.md` | Documentation | Architect reviews for technical accuracy. |
| `docs/requirements/level_specs.md`, `scoring_rules.md`, `coach_phrases.md` | PM | QA and Documentation may derive test cases and references. |
| `docs/requirements/rules_mapping.md` | Documentation | PM supplies rule intent; Architect/QA verify implementation mapping. |
| `src/vehicle/VehiclePhysics.ts`, `src/vehicle/PlayerCar.ts` | Backend | Security may add validation hooks after Backend exposes safe extension points. |
| `src/vehicle/CockpitView.ts`, `src/core/CameraManager.ts`, `src/ui/HUD.ts` | Frontend | UI/UX may provide style requirements; QA may test behavior. |
| `src/ui/variables.css`, `src/ui/results.css`, base `src/ui/hud.css` layout | UI/UX | Frontend may add state classes such as `.is-active`, `.is-warning`, `.is-hidden`. |
| `tests/**`, `vitest.config.ts`, `tests/setup.ts` | QA | Feature agents may add focused tests with QA naming conventions. |
| `.github/workflows/**`, `deploy/**` | DevOps | QA supplies commands; Documentation documents usage. |
| `/status/**`, `/tasks/**`, `docs/coordinator/**` | Coordinator | Other agents update only their own task status and required progress entries. |

If two agents need to edit the same file outside the allowed scope, the first agent must record the conflict in `/status/BLOCKERS.md` or request Coordinator sequencing.

---

## 3. Parallel Work Rules

Parallel-safe first tasks:

* `ARC-001`: project scaffold.
* `PM-001`: level route and acceptance criteria.
* `UI-001`: visual tokens only.
* `DOC-001`: README draft, but command sections must be verified again after `ARC-001`.

Blocked until `ARC-001` is `DONE`:

* `FE-001`, `BE-001`, `QA-001`, `DO-001`, `ARC-003`.

Partially parallel:

* `ARC-002` can define RoadGraph types before Stage 2 is complete.
* Lane detection implementation must wait for vehicle pose, speed, and road context APIs.

---

## 4. Interface Handoffs

Architect to Frontend:
* Stable game loop contract.
* Camera transform API.
* Public update lifecycle.

Architect to Backend:
* Fixed timestep policy.
* TypeScript interfaces for `DrivingContext`, `DrivingFault`, `Lane`, `Junction`, and `RoadSign`.

PM to Architect / QA:
* Level route intent.
* Pass/fail criteria.
* Scoring severity and trigger language.

UI/UX to Frontend:
* CSS variables.
* Base HUD layout.
* Permitted dynamic classes.

Backend to Frontend:
* Vehicle position, rotation, wheel angle, speed in mph, gear, indicator, and observation state.

Documentation to All:
* Canonical public docs for RoadGraph and Highway Code mapping.

---

## 5. Done Definition

A task is `DONE` only when:

* All listed output files exist or were intentionally updated.
* Acceptance criteria are met.
* Relevant task status is updated.
* `/status/PROGRESS_LOG.md` includes date, agent, changed files, issue solved, and next suggested action.
* Any architectural, product, security, or visual decision is recorded in `/status/DECISIONS.md`.


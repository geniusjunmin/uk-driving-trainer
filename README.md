# UK Driving Trainer

UK Driving Trainer is a Web-based 3D practice simulator for new drivers learning UK road rules. It is not a racing game: the MVP focuses on safe repetition of right-hand-drive cockpit control, left-side road positioning, observations, signalling, speed discipline, give-way decisions, mini-roundabouts, zebra crossings, and parking-lot manoeuvres.

The project is in active multi-agent development. The current root workspace contains the verified Vite/TypeScript/Three.js/Rapier/Vitest scaffold.

## MVP Scope

The first demo should provide a compact UK-style town training route with:

* A residential street, Give Way junction, mini-roundabout, zebra crossing, and Tesco-style parking area.
* First-person right-hand-drive cockpit view with speed display in mph.
* Keyboard vehicle controls for steering, throttle, brake, reverse, indicators, handbrake, and observation checks.
* Real-time bilingual coaching prompts and a scoring or fault summary panel.
* Rule checks for left-side driving, speed limits, signalling, giving way, pedestrian priority, and basic parking behaviour.

## Planned Tech Stack

* TypeScript
* Vite
* Three.js with `WebGLRenderer.setAnimationLoop`
* Rapier physics
* Browser runtime: Chrome, Edge, Firefox, and Safari targets
* Node.js 18+ recommended

## Development Setup

```bash
npm install
npm run dev
npm run build
npm run test
```

Verified commands:

| Command | Purpose | Verification Status |
| :--- | :--- | :--- |
| `npm install` | Install project dependencies. | Verified |
| `npm run dev` | Start the local Vite development server. | Verified |
| `npm run build` | Build the production bundle. | Verified |
| `npm run test` | Run the unit and simulation test suite. | Verified: 14 files / 77 tests |

Do not modify `package.json` or build configuration from documentation tasks. Those files are owned by Architect and DevOps according to `docs/coordinator/agent_contracts.md`.

## Planned Directory Structure

```text
/
|-- .github/                 # CI/CD workflows
|-- agents/                  # Agent role definitions
|-- docs/                    # Architecture, requirements, rule mapping, coordination docs
|-- public/                  # Static assets such as models, audio, and fonts
|-- src/
|   |-- main.ts              # Browser entry point
|   |-- core/                # Game loop, time, input, camera
|   |-- vehicle/             # Vehicle physics, player car, cockpit, mirrors
|   |-- road/                # RoadGraph, lanes, junctions, roundabouts
|   |-- traffic/             # NPC vehicles and pedestrians
|   |-- rules/               # Rule engine, speed limits, give-way checks
|   |-- training/            # Scenarios, scoring, instructor prompts
|   |-- ui/                  # HUD, minimap, results overlays
|   `-- data/                # Scenario and RoadGraph JSON data
|-- status/                  # Agent handoff and progress state
|-- tasks/                   # Agent task backlogs and task states
|-- tests/                   # Unit and simulation tests
|-- package.json             # Dependency scripts, created by ARC-001
|-- tsconfig.json            # TypeScript configuration
`-- vite.config.ts           # Vite configuration
```

## Agent Handoff Workflow

Before editing, every agent should:

1. Read `status/CURRENT_CONTEXT.md` for the current project state.
2. Read `docs/coordinator/agent_contracts.md` for file ownership, task states, and parallel-work rules.
3. Read the relevant file in `tasks/` and confirm the task dependencies allow work to start.
4. Edit only files owned by the agent or explicitly allowed by the contract.
5. Update the task state in the relevant `tasks/*.md` file.
6. Append a dated entry to `status/PROGRESS_LOG.md` with changed files, issue solved, and recommended next step.
7. Record blockers in `status/BLOCKERS.md` when coordination is required.

Allowed task states are `TODO`, `IN_PROGRESS`, `NEED_REVIEW`, `DONE`, and `BLOCKED`. Use `NEED_REVIEW` when output is ready but depends on unverified commands, architectural review, product review, or downstream implementation.

## Keyboard Controls

| Key | Planned Action |
| :--- | :--- |
| `W` | Accelerate forward |
| `S` | Brake or reverse, depending on current speed and gear logic |
| `A` | Steer left |
| `D` | Steer right |
| `Q` | Left indicator |
| `E` | Right indicator |
| `R` | Reverse gear or reverse mode |
| `Space` | Handbrake |
| `Mouse` | Look around from the cockpit |
| `Shift` | Observation check / shoulder or blind-spot look modifier |

Final bindings may change during implementation. If gameplay or UI code changes the controls, update this table and the in-game help together.

## Training Rules Overview

The simulator should coach UK learner-driver habits rather than reward speed. Core behaviours include:

* Keep left and maintain appropriate lane position.
* Observe mirrors and blind spots before signalling or manoeuvring.
* Signal clearly when turning, exiting roundabouts, or changing position.
* Respect posted speed limits and display speed in mph.
* Give way correctly at Give Way lines and mini-roundabouts.
* Prioritise pedestrians at zebra crossings.
* Approach junctions with the Position-Speed-Look pattern.
* Use the Mirrors-Signal-Manoeuvre routine before turning or parking.

Detailed Highway Code mappings live in `docs/requirements/rules_mapping.md`.

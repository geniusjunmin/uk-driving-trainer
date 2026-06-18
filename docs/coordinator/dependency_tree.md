# Agent Task Dependency Tree

This dependency tree resolves the first development iteration and identifies safe parallel work.

---

## Mermaid View

```mermaid
graph TD
    CO1["CO-001 status templates"] --> CO2["CO-002 dependency tree and contracts"]

    CO2 --> ARC1["ARC-001 project scaffold"]
    CO2 --> PM1["PM-001 level specs"]
    CO2 --> UI1["UI-001 visual tokens"]
    CO2 --> DOC1["DOC-001 README draft"]

    ARC1 --> FE1["FE-001 Three.js base scene"]
    ARC1 --> BE1["BE-001 Rapier world"]
    ARC1 --> QA1["QA-001 Vitest setup"]
    ARC1 --> DO1["DO-001 Vite build optimization"]
    ARC1 --> ARC2["ARC-002 RoadGraph model"]
    ARC1 --> ARC3["ARC-003 Game and RuleEngine base"]

    PM1 --> PM2["PM-002 scoring rules"]
    PM1 --> PM3["PM-003 coach phrases"]

    ARC2 --> DOC2["DOC-002 RoadGraph public spec"]
    ARC3 --> QA2["QA-002 SpeedLimitRule tests"]
    PM2 --> QA2
    QA1 --> QA2

    BE1 --> BE2["BE-002 PlayerCar physics"]
    BE2 --> QA3["QA-003 car physics tests"]
    QA1 --> QA3

    FE1 --> FE2["FE-002 cockpit and mirrors"]
    FE1 --> FE3["FE-003 HUD overlay"]
    UI1 --> UI2["UI-002 HUD visual style"]
    UI1 --> UI3["UI-003 results panel style"]
    UI2 --> FE3

    ARC3 --> SEC1["SEC-001 delta clamp"]
    BE2 --> SEC2["SEC-002 respawn safety"]
    BE3["BE-003 score storage"] --> SEC3["SEC-003 save integrity check"]

    QA1 --> DO2["DO-002 CI/CD"]
    ARC1 --> DO2
    DO1 --> DO3["DO-003 Docker/Nginx"]

    PM2 --> DOC3["DOC-003 Highway Code mapping"]

    FE2 --> CO3["CO-003 milestone 01 report"]
    BE2 --> CO3
    QA3 --> CO3
```

---

## Execution Notes

* `CO-001` and `CO-002` are complete.
* `ARC-001` and `PM-001` are both HIGH priority and parallel-safe.
* `UI-001` is parallel-safe as long as it only creates visual tokens and does not wire runtime HUD state.
* `DOC-001` may begin as a draft, but command examples must be rechecked after `ARC-001`.
* `ARC-002` owns the technical model notes; `DOC-002` owns the public RoadGraph spec.
* No deadlock is present in the first-iteration graph.


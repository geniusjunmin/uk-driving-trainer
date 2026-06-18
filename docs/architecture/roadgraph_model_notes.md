# RoadGraph Model Notes

## Coordinate System and Units

RoadGraph data is authored in meters. The world uses a right-handed 3D coordinate system with `Y` as vertical height, `X` as lateral/east-west movement, and `Z` as longitudinal/north-south movement. Ground-plane checks such as lane containment and trigger zones normally use `X/Z`; `Y` is retained for slopes, kerbs, bridges, and visual alignment.

`src/road/RoadTypes.ts` defines `Vector3Like` as `{ x, y, z }` instead of storing `THREE.Vector3` instances. Runtime systems may convert these objects into Three.js vectors, but serialized RoadGraph and Scenario files must remain plain JSON-compatible data.

## RoadGraph Shape

The model separates map topology from rule evaluation:

- `RoadNode` marks route endpoints, navigation points, and lane graph anchors.
- `Lane` stores a centerline polyline, lane width, speed limit in mph, permitted turns, and links to adjacent or opposite lanes.
- `RoadSign` stores physical sign placement and the lanes or trigger zones it applies to.
- `TriggerZone` describes rectangular ground-plane regions used by coaching prompts, scoring, and rule activation.
- `Junction` groups connected lanes, conflict zones, local priority rules, signs, and trigger zones.
- `ConflictZone` describes shared space where vehicle paths can overlap, such as Give Way entries, roundabouts, zebra crossings, narrow-road meeting points, and car park entrances.
- `PriorityRule` declares who must yield, stop, or wait for a safe gap before entering a conflict zone.

This keeps the graph readable for designers while giving Backend and QA stable ids for deterministic tests.

## Relationship to PM Level Specs

The PM level specs describe six training routes using ids such as `L1_residential_eastbound_left`, `J3_give_way_t`, `C5_zebra_crossing`, and `P6_target_reverse_bay`. RoadGraph should preserve those ids when possible so product specs, rule mappings, and QA fixtures can refer to the same training object.

Each level can be represented as a Scenario that references:

- `startNodeId` and `endNodeId` from `RoadNode`.
- `routeNodeIds` from `RoadNode` or `RouteNode`.
- `triggerZoneIds` from `TriggerZone`.
- `primaryRules` from `PriorityRule` or later rule-engine ids.
- Lane ids for keep-left, speed-limit, route following, and parking alignment checks.

The RoadGraph should not encode pass/fail scoring directly. It supplies geometry, limits, priorities, and ids; Scenario and RuleEngine layers decide which faults matter for a given level.

## JSON Boundary

RoadGraph content is intended to be loaded from JSON. Keep fields primitive, arrays, or plain objects. Do not add methods, class instances, `Map`, `Set`, typed arrays, or Three.js objects to serialized graph data. Runtime adapters can build caches from the graph after load.

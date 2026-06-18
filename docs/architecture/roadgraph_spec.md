# RoadGraph JSON Specification

This document is the public authoring and loading specification for RoadGraph JSON files in the UK Right-Hand Drive Trainer. It is intended for content authors, Backend loader implementation, QA fixtures, and future Scenario configuration.

The authoritative TypeScript shape is defined in `src/road/RoadTypes.ts`. RoadGraph JSON must stay compatible with those interfaces unless a later architecture task updates both the type definitions and this specification.

---

## 1. Design Goals

RoadGraph describes the physical road layout and local traffic priorities. It does not encode scoring, pass/fail logic, coach phrase timing, or scenario progression rules directly.

RoadGraph supplies:

* stable ids for lanes, nodes, junctions, signs, trigger zones, and conflict zones;
* lane geometry and topology;
* speed limits in mph;
* allowed turns at lane exits;
* priority controls such as Give Way, Stop, roundabout give-right, pedestrian priority, and car park priority;
* rectangular trigger and conflict regions used by Backend, QA, and coaching systems.

Scenario and RuleEngine layers decide which graph elements matter for a given level.

---

## 2. File Shape

Every RoadGraph JSON file is a single object:

```json
{
  "id": "training_town_mvp",
  "version": 1,
  "units": "meters",
  "upAxis": "y",
  "nodes": [],
  "lanes": [],
  "junctions": [],
  "roadSigns": [],
  "triggerZones": [],
  "routeNodes": []
}
```

### Top-Level Fields

| Field | Type | Required | Meaning |
| :--- | :--- | :--- | :--- |
| `id` | string | yes | Stable graph id. Use lowercase snake case for reusable maps. |
| `version` | number | yes | Integer schema/content version. Increment when serialized meaning changes. |
| `units` | `"meters"` | yes | All geometry positions, widths, and bounds are measured in meters. |
| `upAxis` | `"y"` | yes | World vertical axis. Ground-plane checks use X/Z. |
| `nodes` | `RoadNode[]` | yes | Lane graph anchors, route endpoints, and navigation points. |
| `lanes` | `Lane[]` | yes | Drivable lane segments with centerlines, speed limits, turns, and links. |
| `junctions` | `Junction[]` | yes | Grouped junction/crossing/roundabout logic and local priority rules. |
| `roadSigns` | `RoadSign[]` | yes | Physical sign positions and the lanes/zones they apply to. |
| `triggerZones` | `TriggerZone[]` | yes | Rectangular activation regions for rules, hints, and route checks. |
| `routeNodes` | `RouteNode[]` | no | Optional route waypoints that bind nodes to expected lanes or zones. |

Arrays may be empty during early content drafting, but production level graphs should include all ids referenced by scenarios.

---

## 3. Coordinate System and Units

RoadGraph uses a right-handed 3D coordinate system:

* `x`: lateral/east-west position on the ground plane.
* `y`: vertical height. Use `0` for flat roads unless the road has slope, kerb, bridge, or visual alignment requirements.
* `z`: longitudinal/north-south position on the ground plane.

All positions are meters. Lane widths are meters. Trigger and conflict zone bounds are axis-aligned rectangles on the ground plane and use only X/Z:

```json
{
  "minX": -3.5,
  "maxX": 3.5,
  "minZ": 42,
  "maxZ": 52
}
```

Speed limits are in miles per hour because UK learner-driving content and level requirements are authored in mph.

Angles use degrees. `RoadSign.facingYawDegrees` is yaw around the Y axis. `0` should face toward positive Z, `90` toward positive X, `180` toward negative Z, and `270` toward negative X.

---

## 4. Id Conventions

Ids are string keys used by content, Backend, QA, and documentation. They must be stable once a level depends on them.

Recommended prefixes:

| Prefix | Element | Example |
| :--- | :--- | :--- |
| `N` | Road node | `N3_side_road_start` |
| `L` | Lane | `L3_side_road_left` |
| `J` | Junction | `J3_give_way_t` |
| `R` | Roundabout object or junction | `R4_mini_roundabout` |
| `C` | Crossing object or conflict zone | `C5_zebra_crossing` |
| `Z` | Trigger zone | `Z3_give_way_line` |
| `S` | Road sign | `S3_give_way` |
| `P` | Parking bay or target | `P6_target_reverse_bay` |
| `PR` | Priority rule | `PR3_side_road_give_way` |

Do not reuse ids across element arrays. A loader should reject duplicate ids globally.

---

## 5. RoadNode

Road nodes are graph anchors. They are not visual mesh vertices and do not need to match every lane centerline point.

```json
{
  "id": "N3_give_way_line",
  "position": { "x": 0, "y": 0, "z": 100 },
  "label": "Side road give way line"
}
```

| Field | Type | Required | Meaning |
| :--- | :--- | :--- | :--- |
| `id` | string | yes | Stable node id. |
| `position` | `Vector3Like` | yes | World-space position in meters. |
| `label` | string | no | Human-readable authoring note. |

---

## 6. Lane

A lane is one directed drivable segment. UK normal driving should usually place the player in the left lane for their travel direction.

```json
{
  "id": "L3_side_road_left",
  "fromNodeId": "N3_side_road_start",
  "toNodeId": "N3_give_way_line",
  "centerLine": [
    { "x": -1.75, "y": 0, "z": 0 },
    { "x": -1.75, "y": 0, "z": 50 },
    { "x": -1.75, "y": 0, "z": 98 }
  ],
  "widthMeters": 3.5,
  "direction": "forward",
  "speedLimitMph": 30,
  "allowedTurns": ["right"],
  "adjacentLaneIds": ["L3_side_road_right"],
  "oppositeLaneId": "L3_side_road_right",
  "triggerZoneIds": ["Z3_give_way_approach", "Z3_give_way_line"],
  "tags": ["level-3", "side-road", "give-way-approach"]
}
```

| Field | Type | Required | Meaning |
| :--- | :--- | :--- | :--- |
| `id` | string | yes | Stable lane id. |
| `fromNodeId` | string | yes | Start node for lane topology. |
| `toNodeId` | string | yes | End node for lane topology. |
| `centerLine` | `Vector3Like[]` | yes | Ordered centerline polyline in travel direction. Use at least two points. |
| `widthMeters` | number | yes | Drivable width for containment and lane departure checks. |
| `direction` | `"forward"` or `"reverse"` | yes | Authoring direction relative to the road segment. |
| `speedLimitMph` | number | yes | Legal or training speed limit for this lane. |
| `allowedTurns` | array | yes | Permitted exits from this lane: `left`, `right`, `straight`, `u-turn`. |
| `adjacentLaneIds` | string[] | no | Same-direction neighboring lanes, if any. |
| `oppositeLaneId` | string | no | Opposing lane for wrong-way and oncoming checks. |
| `triggerZoneIds` | string[] | no | Zones relevant while driving this lane. |
| `tags` | string[] | no | Authoring labels for filtering and QA. |

### Predecessor and Successor Lanes

RoadGraph v1 expresses lane topology through node ids instead of explicit `predecessorLaneIds` or `successorLaneIds` fields.

A Backend loader should derive:

* predecessors of lane `A`: lanes whose `toNodeId` equals `A.fromNodeId`;
* successors of lane `A`: lanes whose `fromNodeId` equals `A.toNodeId`;
* valid successors: derived successors filtered by `A.allowedTurns`, junction rules, route intent, and any lane-specific tags.

Example:

```json
[
  {
    "id": "L3_side_road_left",
    "fromNodeId": "N3_side_road_start",
    "toNodeId": "N3_give_way_line",
    "centerLine": [
      { "x": -1.75, "y": 0, "z": 0 },
      { "x": -1.75, "y": 0, "z": 98 }
    ],
    "widthMeters": 3.5,
    "direction": "forward",
    "speedLimitMph": 30,
    "allowedTurns": ["right"]
  },
  {
    "id": "L3_main_road_westbound_left",
    "fromNodeId": "N3_give_way_line",
    "toNodeId": "N3_main_road_finish",
    "centerLine": [
      { "x": -1.75, "y": 0, "z": 100 },
      { "x": -70, "y": 0, "z": 100 }
    ],
    "widthMeters": 3.5,
    "direction": "forward",
    "speedLimitMph": 30,
    "allowedTurns": ["straight"]
  }
]
```

Here `L3_main_road_westbound_left` is a successor of `L3_side_road_left` because its `fromNodeId` matches the side road lane's `toNodeId`. The turn is only route-valid if the junction permits a right turn from the side road into the westbound left lane.

---

## 7. RoadSign

Road signs place a physical sign in the world and bind it to the lanes or trigger zone it controls.

```json
{
  "id": "S3_give_way",
  "type": "give-way",
  "position": { "x": -3.8, "y": 0, "z": 94 },
  "facingYawDegrees": 180,
  "appliesToLaneIds": ["L3_side_road_left"],
  "triggerZoneId": "Z3_give_way_line",
  "label": "Give Way before T-junction"
}
```

| Field | Type | Required | Meaning |
| :--- | :--- | :--- | :--- |
| `id` | string | yes | Stable sign id. |
| `type` | `RoadSignType` | yes | Sign category. |
| `position` | `Vector3Like` | yes | Sign location in meters. |
| `facingYawDegrees` | number | yes | Direction the sign face points. |
| `appliesToLaneIds` | string[] | yes | Controlled lanes. |
| `speedLimitMph` | number | no | Required for `speed-limit` signs. |
| `triggerZoneId` | string | no | Zone where the sign/rule becomes active. |
| `label` | string | no | Human-readable authoring note. |

Supported `type` values are `speed-limit`, `give-way`, `stop`, `roundabout`, `zebra-crossing`, `parking`, `school-zone`, and `warning`.

### Speed Limit Sign

```json
{
  "id": "S5_school_20",
  "type": "speed-limit",
  "position": { "x": -4.2, "y": 0, "z": 12 },
  "facingYawDegrees": 180,
  "appliesToLaneIds": ["L5_school_zone_left"],
  "speedLimitMph": 20,
  "triggerZoneId": "Z5_school_20_entry",
  "label": "20 mph school zone entry"
}
```

For speed limits, the lane's `speedLimitMph` should match the effective zone. The sign records how the player is informed; the lane records what Backend should enforce.

---

## 8. TriggerZone

Trigger zones are axis-aligned rectangular ground-plane regions. They are used for coaching, scoring activation, route progress, and sign/rule transitions.

```json
{
  "id": "Z3_give_way_line",
  "bounds": {
    "minX": -4,
    "maxX": 4,
    "minZ": 94,
    "maxZ": 100
  },
  "laneIds": ["L3_side_road_left"],
  "ruleIds": ["PR3_side_road_give_way"],
  "label": "Give Way line activation zone"
}
```

| Field | Type | Required | Meaning |
| :--- | :--- | :--- | :--- |
| `id` | string | yes | Stable zone id. |
| `bounds` | `Bounds2D` | yes | X/Z rectangle in meters. |
| `laneIds` | string[] | no | Lanes this zone belongs to. |
| `ruleIds` | string[] | no | Priority/rule ids activated by this zone. |
| `label` | string | no | Human-readable authoring note. |

---

## 9. ConflictZone

A conflict zone is a shared space where paths can overlap or where another road user has priority.

```json
{
  "id": "CZ3_t_junction_crossing",
  "bounds": {
    "minX": -8,
    "maxX": 8,
    "minZ": 96,
    "maxZ": 108
  },
  "entryLaneIds": ["L3_side_road_left"],
  "exitLaneIds": ["L3_main_road_westbound_left"],
  "priorityRuleIds": ["PR3_side_road_give_way"],
  "stopLine": [
    { "x": -3.5, "y": 0, "z": 96 },
    { "x": 0, "y": 0, "z": 96 }
  ],
  "label": "T-junction Give Way conflict area"
}
```

| Field | Type | Required | Meaning |
| :--- | :--- | :--- | :--- |
| `id` | string | yes | Stable conflict-zone id. |
| `bounds` | `Bounds2D` | yes | Shared X/Z area. |
| `entryLaneIds` | string[] | yes | Lanes entering the conflict. |
| `exitLaneIds` | string[] | yes | Lanes leaving the conflict. |
| `priorityRuleIds` | string[] | yes | Priority rules governing this area. |
| `stopLine` | `Vector3Like[]` | no | Optional line where vehicles should stop or yield. |
| `label` | string | no | Human-readable authoring note. |

Use conflict zones for Give Way junctions, Stop junctions, roundabout entries, zebra crossings, narrow-road oncoming priority, car park entrances, and pedestrian walkways.

---

## 10. PriorityRule

Priority rules state who must wait, stop, yield, or find a safe gap before entering a conflict zone.

```json
{
  "id": "PR3_side_road_give_way",
  "type": "give-way",
  "controlledLaneIds": ["L3_side_road_left"],
  "priorityLaneIds": ["L3_main_road_eastbound_left", "L3_main_road_westbound_left"],
  "conflictZoneId": "CZ3_t_junction_crossing",
  "signId": "S3_give_way",
  "mustStop": false,
  "minimumClearGapSeconds": 4,
  "label": "Side road yields to main road traffic"
}
```

| Field | Type | Required | Meaning |
| :--- | :--- | :--- | :--- |
| `id` | string | yes | Stable priority-rule id. |
| `type` | `PriorityRuleType` | yes | Priority behavior. |
| `controlledLaneIds` | string[] | yes | Lanes that must yield, stop, or wait. |
| `priorityLaneIds` | string[] | no | Lanes or flows with priority over controlled lanes. |
| `conflictZoneId` | string | no | Conflict zone governed by this rule. |
| `signId` | string | no | Road sign associated with the rule. |
| `mustStop` | boolean | no | True when a full stop is required before proceeding. |
| `minimumClearGapSeconds` | number | no | Minimum safe gap before entering the conflict zone. |
| `label` | string | no | Human-readable authoring note. |

Supported `type` values are `give-way`, `stop`, `roundabout-give-right`, `pedestrian-priority`, `oncoming-priority`, and `carpark-priority`.

---

## 11. Junction

A junction groups connected lanes, local conflict zones, priority rules, signs, and trigger zones.

```json
{
  "id": "J3_give_way_t",
  "type": "t-junction",
  "center": { "x": 0, "y": 0, "z": 100 },
  "connectedLaneIds": [
    "L3_side_road_left",
    "L3_main_road_eastbound_left",
    "L3_main_road_westbound_left"
  ],
  "conflictZones": [
    {
      "id": "CZ3_t_junction_crossing",
      "bounds": {
        "minX": -8,
        "maxX": 8,
        "minZ": 96,
        "maxZ": 108
      },
      "entryLaneIds": ["L3_side_road_left"],
      "exitLaneIds": ["L3_main_road_westbound_left"],
      "priorityRuleIds": ["PR3_side_road_give_way"],
      "stopLine": [
        { "x": -3.5, "y": 0, "z": 96 },
        { "x": 0, "y": 0, "z": 96 }
      ],
      "label": "T-junction Give Way conflict area"
    }
  ],
  "priorityRules": [
    {
      "id": "PR3_side_road_give_way",
      "type": "give-way",
      "controlledLaneIds": ["L3_side_road_left"],
      "priorityLaneIds": ["L3_main_road_eastbound_left", "L3_main_road_westbound_left"],
      "conflictZoneId": "CZ3_t_junction_crossing",
      "signId": "S3_give_way",
      "mustStop": false,
      "minimumClearGapSeconds": 4,
      "label": "Side road yields to main road traffic"
    }
  ],
  "signIds": ["S3_give_way"],
  "triggerZoneIds": ["Z3_give_way_approach", "Z3_give_way_line"]
}
```

| Field | Type | Required | Meaning |
| :--- | :--- | :--- | :--- |
| `id` | string | yes | Stable junction id. |
| `type` | string enum | yes | `t-junction`, `crossroads`, `roundabout`, `carpark-entry`, or `crossing`. |
| `center` | `Vector3Like` | yes | Approximate world-space center. |
| `connectedLaneIds` | string[] | yes | Lanes that enter, leave, or pass through the junction. |
| `conflictZones` | `ConflictZone[]` | yes | Shared conflict areas inside this junction. |
| `priorityRules` | `PriorityRule[]` | yes | Local yielding/stopping/priority behavior. |
| `signIds` | string[] | no | Signs associated with this junction. |
| `triggerZoneIds` | string[] | no | Zones associated with this junction. |

---

## 12. Required Traffic Controls

### Give Way

Represent Give Way with `RoadSign.type = "give-way"`, a trigger zone at the approach or line, a conflict zone covering the shared road space, and a priority rule with `type = "give-way"`. Use `mustStop: false` because the player may proceed slowly if visibility and gap are safe.

### Stop

Represent Stop like Give Way, but use `RoadSign.type = "stop"`, `PriorityRule.type = "stop"`, `mustStop: true`, and a clearly authored `stopLine`.

```json
{
  "id": "PR_stop_side_road",
  "type": "stop",
  "controlledLaneIds": ["L_stop_side_road_left"],
  "priorityLaneIds": ["L_main_eastbound_left", "L_main_westbound_left"],
  "conflictZoneId": "CZ_stop_crossing",
  "signId": "S_stop",
  "mustStop": true,
  "minimumClearGapSeconds": 4,
  "label": "Full stop required before joining main road"
}
```

### Roundabout

Represent a roundabout with `Junction.type = "roundabout"`, `RoadSign.type = "roundabout"` at each approach as needed, entry lanes whose `allowedTurns` describe intended exits, `PriorityRule.type = "roundabout-give-right"`, and conflict zones per entry or per circulatory sector.

```json
{
  "id": "PR4_south_entry_give_right",
  "type": "roundabout-give-right",
  "controlledLaneIds": ["L4_south_entry_left"],
  "priorityLaneIds": ["L4_roundabout_circulatory"],
  "conflictZoneId": "CZ4_south_entry",
  "signId": "S4_roundabout_south",
  "mustStop": false,
  "minimumClearGapSeconds": 3,
  "label": "South entry gives way to traffic from the right"
}
```

### Zebra Crossing

Represent a zebra crossing with `Junction.type = "crossing"`, `RoadSign.type = "zebra-crossing"`, `PriorityRule.type = "pedestrian-priority"`, controlled vehicle approach lanes, a conflict zone covering the crossing stripes and stop approach, and trigger zones for approach hints and restart observation.

```json
{
  "id": "J5_school_zebra_crossing",
  "type": "crossing",
  "center": { "x": 0, "y": 0, "z": 70 },
  "connectedLaneIds": ["L5_school_zone_left", "L5_school_zone_opposite"],
  "conflictZones": [
    {
      "id": "C5_zebra_crossing",
      "bounds": {
        "minX": -4.5,
        "maxX": 4.5,
        "minZ": 66,
        "maxZ": 74
      },
      "entryLaneIds": ["L5_school_zone_left", "L5_school_zone_opposite"],
      "exitLaneIds": ["L5_school_zone_left", "L5_school_zone_opposite"],
      "priorityRuleIds": ["PR5_zebra_pedestrian_priority"],
      "stopLine": [
        { "x": -3.5, "y": 0, "z": 64 },
        { "x": 0, "y": 0, "z": 64 }
      ],
      "label": "School zebra crossing conflict area"
    }
  ],
  "priorityRules": [
    {
      "id": "PR5_zebra_pedestrian_priority",
      "type": "pedestrian-priority",
      "controlledLaneIds": ["L5_school_zone_left", "L5_school_zone_opposite"],
      "conflictZoneId": "C5_zebra_crossing",
      "signId": "S5_zebra_crossing",
      "mustStop": true,
      "minimumClearGapSeconds": 2,
      "label": "Vehicles yield to pedestrians on or waiting to use the crossing"
    }
  ],
  "signIds": ["S5_zebra_crossing"],
  "triggerZoneIds": ["C5_zebra_approach", "C5_zebra_stop_line", "Z5_restart_observation"]
}
```

---

## 13. RouteNode

Route nodes optionally bind graph nodes to expected lanes and trigger zones for scenario progress.

```json
{
  "id": "RN3_give_way",
  "nodeId": "N3_give_way_line",
  "expectedLaneId": "L3_side_road_left",
  "triggerZoneId": "Z3_give_way_line"
}
```

| Field | Type | Required | Meaning |
| :--- | :--- | :--- | :--- |
| `id` | string | yes | Stable route-node id. |
| `nodeId` | string | yes | RoadNode this route point references. |
| `expectedLaneId` | string | no | Lane the player should occupy near this route point. |
| `triggerZoneId` | string | no | Zone used to mark route progress. |

---

## 14. Complete Minimal Example

```json
{
  "id": "level_3_give_way_sample",
  "version": 1,
  "units": "meters",
  "upAxis": "y",
  "nodes": [
    {
      "id": "N3_side_road_start",
      "position": { "x": -1.75, "y": 0, "z": 0 },
      "label": "Level 3 start"
    },
    {
      "id": "N3_give_way_line",
      "position": { "x": -1.75, "y": 0, "z": 96 },
      "label": "Give Way line"
    },
    {
      "id": "N3_main_road_finish",
      "position": { "x": -70, "y": 0, "z": 100 },
      "label": "Main road finish"
    }
  ],
  "lanes": [
    {
      "id": "L3_side_road_left",
      "fromNodeId": "N3_side_road_start",
      "toNodeId": "N3_give_way_line",
      "centerLine": [
        { "x": -1.75, "y": 0, "z": 0 },
        { "x": -1.75, "y": 0, "z": 50 },
        { "x": -1.75, "y": 0, "z": 96 }
      ],
      "widthMeters": 3.5,
      "direction": "forward",
      "speedLimitMph": 30,
      "allowedTurns": ["right"],
      "oppositeLaneId": "L3_side_road_right",
      "triggerZoneIds": ["Z3_give_way_approach", "Z3_give_way_line"],
      "tags": ["level-3", "give-way-approach"]
    },
    {
      "id": "L3_main_road_westbound_left",
      "fromNodeId": "N3_give_way_line",
      "toNodeId": "N3_main_road_finish",
      "centerLine": [
        { "x": -1.75, "y": 0, "z": 100 },
        { "x": -35, "y": 0, "z": 100 },
        { "x": -70, "y": 0, "z": 100 }
      ],
      "widthMeters": 3.5,
      "direction": "forward",
      "speedLimitMph": 30,
      "allowedTurns": ["straight"],
      "triggerZoneIds": ["Z3_turn_entry_lane"],
      "tags": ["level-3", "main-road"]
    }
  ],
  "junctions": [
    {
      "id": "J3_give_way_t",
      "type": "t-junction",
      "center": { "x": 0, "y": 0, "z": 100 },
      "connectedLaneIds": [
        "L3_side_road_left",
        "L3_main_road_westbound_left"
      ],
      "conflictZones": [
        {
          "id": "CZ3_t_junction_crossing",
          "bounds": {
            "minX": -8,
            "maxX": 8,
            "minZ": 96,
            "maxZ": 108
          },
          "entryLaneIds": ["L3_side_road_left"],
          "exitLaneIds": ["L3_main_road_westbound_left"],
          "priorityRuleIds": ["PR3_side_road_give_way"],
          "stopLine": [
            { "x": -3.5, "y": 0, "z": 96 },
            { "x": 0, "y": 0, "z": 96 }
          ],
          "label": "T-junction Give Way conflict area"
        }
      ],
      "priorityRules": [
        {
          "id": "PR3_side_road_give_way",
          "type": "give-way",
          "controlledLaneIds": ["L3_side_road_left"],
          "priorityLaneIds": ["L3_main_road_westbound_left"],
          "conflictZoneId": "CZ3_t_junction_crossing",
          "signId": "S3_give_way",
          "mustStop": false,
          "minimumClearGapSeconds": 4,
          "label": "Side road gives way before turning right"
        }
      ],
      "signIds": ["S3_give_way"],
      "triggerZoneIds": ["Z3_give_way_approach", "Z3_give_way_line"]
    }
  ],
  "roadSigns": [
    {
      "id": "S3_give_way",
      "type": "give-way",
      "position": { "x": -3.8, "y": 0, "z": 94 },
      "facingYawDegrees": 180,
      "appliesToLaneIds": ["L3_side_road_left"],
      "triggerZoneId": "Z3_give_way_line",
      "label": "Give Way before T-junction"
    }
  ],
  "triggerZones": [
    {
      "id": "Z3_give_way_approach",
      "bounds": {
        "minX": -4,
        "maxX": 4,
        "minZ": 46,
        "maxZ": 96
      },
      "laneIds": ["L3_side_road_left"],
      "ruleIds": ["PR3_side_road_give_way"],
      "label": "Approach zone for slowing and signal checks"
    },
    {
      "id": "Z3_give_way_line",
      "bounds": {
        "minX": -4,
        "maxX": 4,
        "minZ": 94,
        "maxZ": 100
      },
      "laneIds": ["L3_side_road_left"],
      "ruleIds": ["PR3_side_road_give_way"],
      "label": "Give Way line"
    },
    {
      "id": "Z3_turn_entry_lane",
      "bounds": {
        "minX": -28,
        "maxX": 0,
        "minZ": 96,
        "maxZ": 104
      },
      "laneIds": ["L3_main_road_westbound_left"],
      "label": "Check correct left lane after right turn"
    }
  ],
  "routeNodes": [
    {
      "id": "RN3_start",
      "nodeId": "N3_side_road_start",
      "expectedLaneId": "L3_side_road_left"
    },
    {
      "id": "RN3_give_way",
      "nodeId": "N3_give_way_line",
      "expectedLaneId": "L3_side_road_left",
      "triggerZoneId": "Z3_give_way_line"
    },
    {
      "id": "RN3_finish",
      "nodeId": "N3_main_road_finish",
      "expectedLaneId": "L3_main_road_westbound_left"
    }
  ]
}
```

---

## 15. Backend Loader Requirements

A conforming loader should:

1. Parse JSON into plain data objects only.
2. Reject missing required top-level arrays.
3. Reject duplicate ids across all RoadGraph elements.
4. Verify every referenced id exists.
5. Verify `units` is `meters` and `upAxis` is `y`.
6. Verify lanes have at least two centerline points and positive `widthMeters`.
7. Verify `speedLimitMph` is positive and matches any linked `speed-limit` sign where applicable.
8. Build lane predecessor/successor lookup tables from `fromNodeId` and `toNodeId`.
9. Build lane-to-zone, sign-to-lane, junction-to-lane, and priority-rule indexes for runtime queries.
10. Preserve original ids and labels for QA diagnostics and coaching messages.

The loader may create runtime caches, Three.js vectors, spatial indexes, or pathfinding graphs after validation. Those runtime structures must not be written back into RoadGraph JSON.


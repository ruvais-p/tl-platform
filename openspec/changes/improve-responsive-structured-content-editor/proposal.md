## Why

Curriculum authors currently edit chapter completion rules, activity completion rules, and flexible activity content as raw JSON text. This preserves arbitrary payloads but makes common authoring tasks error-prone and particularly difficult on narrow screens, while the current save sequence can partially update an activity before discovering invalid content JSON.

## What Changes

- Add responsive, structured controls for recognized chapter and activity completion-rule fields.
- Add a responsive structured-content editor for nested objects, arrays, and primitive values, with approachable add, remove, reorder, and type-aware editing interactions.
- Retain an advanced raw-JSON fallback and preserve every unsupported or unknown field during structured editing.
- Validate the complete activity and content submission before issuing API mutations, with inline syntax and field feedback.
- Adapt content sections and save actions for mobile, tablet, and desktop layouts without changing the existing hierarchy drill-in flow.
- Add focused tests for responsive behavior, accessibility, JSON validation, unknown-field preservation, and save ordering.
- Keep activity-specific Video, Experiment, Practice Set, and Media Asset management outside this change; their dedicated APIs are not currently exposed by the admin frontend proxy.

## Capabilities

### New Capabilities

- `responsive-structured-content-authoring`: Responsive structured editing of curriculum JSON fields with advanced raw JSON access, preservation guarantees, validation, and safe submission behavior.

### Modified Capabilities

None.

## Impact

- Frontend: the curriculum inspector, curriculum domain types/helpers, reusable form controls, styling, and component tests under `admin-platform/src`.
- API usage: existing curriculum and activity-content endpoints and payloads remain unchanged; no backend schema or endpoint change is required.
- UX: chapter and activity JSON fields become form-driven by default, while raw JSON remains available for advanced and forward-compatible content.
- Compatibility: existing activity content and unknown keys remain round-trippable; this change introduces no breaking API behavior and no new runtime dependency is expected.

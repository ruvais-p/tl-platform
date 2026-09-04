## 1. Structured JSON Foundation

- [x] 1.1 Define recursive JSON value types, cloning/update helpers, and object-root validation for curriculum JSON fields; verify unit tests cover every JSON primitive, nested objects and arrays, and invalid roots.
- [x] 1.2 Implement canonical structured-value state with a separate raw-text draft and explicit apply/reset behavior; verify tests prove invalid text is retained without replacing the last valid value.
- [x] 1.3 Add unknown-key merge and round-trip helpers for specialized adapters; verify tests demonstrate that editing recognized keys preserves nested unsupported fields exactly.

## 2. Responsive JSON Editor Components

- [x] 2.1 Build recursive object, array, and primitive editors with add, remove, reorder, type-change, and collapse controls; verify component tests cover all collection operations and resulting JSON values.
- [x] 2.2 Add the disclosed advanced raw JSON editor with format, apply, validation, and unapplied-draft protection; verify valid, invalid-syntax, and invalid-root scenarios in component tests.
- [x] 2.3 Add inline error association, accessible names, keyboard collection actions, focus management, and live validation announcements; verify accessibility tests report no serious or critical violations and keyboard interaction tests pass.

## 3. Completion-Rule Adapters

- [x] 3.1 Implement chapter completion controls for required subtopics, case study, learning check, and pass percentage; verify serialization and hydration tests match the backend's existing completion-rule keys.
- [x] 3.2 Implement activity-type-aware controls for watch percentage and generic completion while exposing additional fields; verify changing controls and activity type never silently removes unknown keys.
- [x] 3.3 Integrate the completion-rule adapters into chapter and activity inspectors; verify existing rules load correctly and saved requests contain API-compatible objects.

## 4. Activity Content and Save Safety

- [x] 4.1 Integrate the responsive structured-content editor with existing and new activity-content records while retaining editable content type; verify create and update request tests use the correct activity and content-record identifiers.
- [x] 4.2 Refactor inspector submission to construct and validate every local curriculum and content value before any mutation; verify an invalid structured or raw value results in zero API mutation calls and identifies the failing section.
- [x] 4.3 Add explicit split-success handling and content retry when activity update succeeds but content update fails; verify tests retain the attempted content, communicate the partial result, and retry only the unsaved content stage.
- [x] 4.4 Preserve dirty-state protection across hierarchy selection, cancel, raw-mode transitions, and failed saves; verify tests confirm edits are neither silently discarded nor incorrectly marked clean.

## 5. Responsive Integration and Verification

- [x] 5.1 Apply single-column narrow-screen composition, bounded nesting, local overflow for long values, and wider-screen field grouping; verify rendered layouts at representative phone, tablet, and desktop viewport sizes have no page-level horizontal overflow.
- [x] 5.2 Add a narrow-screen action area with reachable Save and safely wrapped secondary and destructive controls while retaining the desktop action layout; verify keyboard, zoom, and viewport tests keep actions accessible without obscuring the final field.
- [x] 5.3 Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build` in `admin-platform`, then manually smoke-test recognized rules, arbitrary nested content, invalid JSON, unknown-key preservation, and partial content-save recovery at narrow and wide viewports.

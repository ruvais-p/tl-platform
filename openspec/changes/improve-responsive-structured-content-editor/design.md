## Context

See `proposal.md` for motivation and `specs/responsive-structured-content-authoring/spec.md` for behavioral requirements.

The Next.js curriculum editor currently lives primarily in one client component. Django returns a nested course read model, while mutations target individual curriculum resources and a separate one-to-one `ActivityContent` resource. Chapter and activity `completion_rule` fields and `ActivityContent.content` are JSON fields. The API deliberately permits flexible activity content and existing records may contain unrecognized keys.

Known completion-rule shapes are already expressed in Django's management form and seed data. Chapter rules use `required_subtopics`, `case_study_required`, `learning_check_required`, and `learning_check_pass_percentage`; common activity rules include `complete` and `watch_percentage`. Flexible seeded activity content contains nested `source` and `facilitation` objects, but the API does not enforce a universal activity-content schema.

## Goals / Non-Goals

**Goals:**

- Separate structured JSON state and validation from the large curriculum inspector component.
- Make common completion rules understandable without exposing storage syntax.
- Support arbitrary JSON recursively and preserve unknown data.
- Prevent locally detectable errors from causing partial writes.
- Maintain usable layout and actions from phone-sized viewports through desktop.

**Non-Goals:**

- Define a universal server-side schema for `ActivityContent.content`.
- Add or expose the dedicated Video, Experiment, Practice Set, Practice Item, or Media Asset APIs.
- Make the two existing API mutations transactionally atomic.
- Replace the hierarchy rail or its narrow-screen drill-in navigation.
- Add collaborative editing, autosave, or conflict detection.

## Decisions

### Use one canonical structured value with an explicit raw-edit draft

Each JSON-backed field will maintain a last-valid structured value. Structured controls update that value immutably. Opening advanced JSON serializes the canonical value into a separate text draft; applying the draft parses and validates it before replacing the canonical value. Invalid raw text remains visible but never becomes submit-ready state.

This avoids two live sources of truth. Continuously parsing the textarea on every keystroke was considered but rejected because temporarily invalid text is normal while typing and would destabilize structured controls.

### Build a small recursive JSON editor with specialized adapters

A reusable recursive editor will handle object, array, string, number, boolean, and null nodes. It will provide collection operations and bounded visual nesting. Thin adapters will render recognized completion rules as purpose-specific controls and merge their output into the canonical object without removing unknown keys.

A third-party schema-form package was considered but rejected for this scope: the API has no authoritative JSON Schema, bundle and interaction costs would be disproportionate, and unknown-key preservation still needs custom handling. A collection of activity-specific hard-coded forms was also rejected because most content shapes remain flexible.

### Select specialized completion fields from resource context

Chapter rules always use the known chapter adapter. Activity rules select controls using `activity_type`: video activities expose watch percentage, while generic completion-based activities expose a completion toggle. Any remaining keys are summarized as additional fields and remain editable recursively or through raw JSON.

Adapters will own only their recognized keys. Changing an activity type will not silently delete the previous type's unrecognized completion keys; authors can inspect or remove them explicitly in the additional-fields area.

### Validate the full form before network mutations

The inspector will first construct and validate curriculum payload, completion rules, content type, and activity content. Only a successful local validation result can start the existing sequential requests. This fixes the current path where the activity PATCH occurs before content JSON is parsed.

The existing API cannot make the curriculum-resource and activity-content requests atomic. If the first succeeds and the second fails, the editor will retain the attempted content, report the split outcome explicitly, and allow retrying content without suggesting that the activity PATCH failed. A new transactional backend endpoint was considered but rejected because it expands API scope for a frontend usability change.

### Use responsive composition rather than width-specific editors

The same semantic controls will render at every viewport. Primitive field groups use one column by default and multiple columns only when space permits. Objects and arrays remain full-width, collapse independently, and reduce indentation on narrow screens. Code-like inputs contain their own horizontal overflow so they cannot widen the page.

On narrow screens, primary actions will use a persistent or sticky action area that respects safe-area spacing; Save receives strongest prominence and secondary/destructive actions wrap below it. On wider screens, actions return to the existing compact footer arrangement. This preserves one behavior model and avoids divergent mobile state.

### Keep API contracts unchanged

Structured controls serialize to the current JSON fields and continue using the existing curriculum and activity-content routes. `content_type` remains editable, defaulting to `application/json`. Frontend types will narrow known shapes while retaining an indexable JSON value type for unknown data.

No dedicated content endpoint will be added to the BFF allowlist in this change. The UI must not imply that editing flexible `ActivityContent.content` also edits separately stored video, experiment, practice, or media records.

## Risks / Trade-offs

- [A recursive editor can become unwieldy for very large or deeply nested content] -> Collapse nested sections by default beyond a shallow depth, cap indentation, and retain the raw editor for bulk changes.
- [JavaScript numbers cannot exactly represent every possible JSON number] -> Preserve normal API-sized numbers and document raw JSON as the escape hatch; do not introduce non-JSON numeric types.
- [Recognized adapters may lag future backend conventions] -> Own only explicitly recognized keys and preserve all other keys through the generic representation.
- [Sequential activity and content requests can still partially succeed] -> Validate before either request and report/retry the content stage independently after a server or network failure.
- [Sticky actions can obscure content on small screens] -> Reserve bottom spacing, respect safe areas, and verify keyboard and zoom behavior at target breakpoints.
- [Switching between raw and structured modes can surprise authors] -> Require an explicit Apply action for raw edits and warn before discarding an unapplied raw draft.

## Migration Plan

1. Introduce JSON value utilities, immutable update helpers, validation, and round-trip tests without changing API requests.
2. Add the recursive editor and advanced raw fallback with accessibility coverage.
3. Add chapter and activity completion-rule adapters and preservation tests.
4. Integrate structured state into the inspector and move all parsing/validation before mutations.
5. Add split-success messaging and retry behavior for the two-request activity save.
6. Apply responsive action and nested-section layouts, then verify phone, tablet, desktop, keyboard, and zoom behavior.

Deployment requires no data migration. Rollback restores the raw textareas; stored JSON remains compatible because the API payload shapes do not change.

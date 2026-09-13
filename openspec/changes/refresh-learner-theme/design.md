## Context

See `proposal.md` for motivation and `specs/learner-interface-branding/spec.md` for observable requirements. The Next.js application currently installs Geist on the root document, while learner pages opt into semantic color overrides through `.learner-theme`. Shared learner components already rely predominantly on tokens such as `primary`, `secondary`, `accent`, `background`, and `ring`, but some small labels use the primary token as foreground text.

The supplied colors are all too light for white text at normal sizes. `#3AB664` has a 2.61:1 contrast ratio against white, `#66D2E3` has 1.77:1, and `#B5E5F8` has 1.35:1. They therefore require dark foregrounds and a darker derived green for small standalone text and focus outlines.

## Goals / Non-Goals

**Goals:**

- Keep the brand implementation centralized in the learner theme rather than distributing raw colors throughout components.
- Load the required Poppins weights once and apply them to every `/learn` route.
- Preserve WCAG AA text contrast and visible keyboard focus while displaying the exact supplied colors in their assigned surface roles.
- Make the learner/admin styling boundary easy to verify and maintain.

**Non-Goals:**

- Redesigning page structure, spacing, component geometry, motion, or learner navigation.
- Recoloring destructive and warning feedback with colors that would obscure their semantic meaning.
- Rebranding admin routes, the Moodle plugin, or the independently styled GraphSpace content.
- Adding a learner dark theme.

## Decisions

### Scope the font at the `/learn` route boundary

Add a learner route layout that configures Poppins through `next/font/google` with weights 400, 500, 600, and 700, `display: "swap"`, and a CSS variable. The layout will expose that variable to all learner descendants, while `.learner-theme` will set its font family to Poppins followed by a generic sans-serif fallback.

This keeps the root admin typography on Geist and covers both the login page and authenticated route group. Loading Poppins in the root application layout was considered, but rejected because it broadens the font concern and load scope beyond learner routes.

### Map exact brand colors to surface-oriented semantic tokens

Update the learner theme so the exact approved colors drive these roles:

| Semantic role | Value | Usage |
|---|---|---|
| Primary brand surface | `#3AB664` | Primary buttons, progress, and strong active surfaces |
| Secondary surface | `#66D2E3` | Secondary navigation and informational emphasis |
| Soft accent surface | `#B5E5F8` | Selections, highlights, and subtle panels |
| Brand foreground | `#0F172A` | Text and icons placed on all three supplied colors |
| Strong brand green | darker derivative of `#3AB664` meeting 4.5:1 on the page background | Small green labels, links, and other standalone brand-colored text |
| Focus ring | darker derivative of `#3AB664` meeting 3:1 against adjacent surfaces | Keyboard focus indication |

Neutral tokens remain available for page backgrounds, cards, body text, borders, and muted content. This avoids forcing the three supplied colors into roles they cannot fulfill accessibly.

Using white on the primary green was rejected because it fails WCAG AA for both normal and large text. Darkening the main supplied colors globally was also rejected because it would no longer display the exact requested palette.

### Separate foreground emphasis from filled-surface emphasis

Retain the existing semantic token workflow for shared UI components, but add a learner-scoped strong-brand token for standalone text. Replace learner-only uses where `text-primary` represents small copy with that accessible strong token; retain `bg-primary` for exact green surfaces paired with the dark primary foreground.

This targeted split is necessary because one color cannot simultaneously preserve the exact green surface and meet contrast requirements as small text on a light background. Scattered raw hex utilities were considered, but rejected because they would make later palette changes inconsistent.

### Preserve semantic feedback colors

Success, warning, and destructive states remain separately identifiable. Success may use a darker green derived from the primary brand where it remains distinguishable from ordinary primary actions; warning and destructive colors retain their existing semantic families.

The three brand colors can also be used for decorative or chart accents when present, provided adjacent values remain distinguishable and do not communicate success or failure solely through color.

### Validate representative learner states

Verification will cover the learner login, shell navigation, dashboard, course library/detail, activity, learning check, chatbot, loading state, and mobile navigation. Automated checks will cover static theme/font wiring, existing accessibility assertions, type checking, and tests. A manual browser pass will confirm rendered font, responsive styling, hover/focus states, and visual isolation from an admin route.

## Risks / Trade-offs

- **Poppins increases learner-route font assets** -> Limit loading to the four weights used by the interface, use `display: "swap"`, and scope it to `/learn`.
- **A single primary token is currently used for both surfaces and small text** -> Introduce a strong accessible brand-text token and migrate only learner foreground usages.
- **Green is both the brand primary and a conventional success color** -> Use layout, icons, labels, and a darker success treatment so meaning never depends on hue alone.
- **Broad global token edits could affect admin pages** -> Keep all palette overrides under `.learner-theme` and add regression coverage for the route boundary.
- **Embedded applications will not visually match the refreshed shell** -> Treat this as intentional isolation; rebranding those applications requires a separate change.

## Migration Plan

1. Add the learner route font boundary and confirm Poppins applies to login and authenticated learner routes.
2. Update learner-scoped palette and accessibility tokens.
3. Migrate standalone learner brand text and any exceptional hard-coded learner colors to semantic tokens.
4. Run automated checks and inspect representative learner/admin pages at desktop and mobile widths.
5. Roll back by reverting the learner route font wrapper, learner token values, and targeted token migrations; no data or API migration is involved.

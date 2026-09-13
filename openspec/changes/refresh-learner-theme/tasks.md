## 1. Learner Typography Boundary

- [x] 1.1 Add a `/learn` route layout that loads Poppins weights 400, 500, 600, and 700 through `next/font/google` with swap behavior, and verify both the learner login and authenticated route group receive the font variable while an admin route does not.
- [x] 1.2 Apply the Poppins variable as the preferred font within `.learner-theme` with a generic sans-serif fallback, and verify computed learner text uses Poppins without changing the root Geist configuration.

## 2. Learner Brand Palette

- [x] 2.1 Define learner-scoped semantic tokens for the exact `#3AB664` primary surface, `#66D2E3` secondary surface, `#B5E5F8` soft accent surface, dark brand foreground, accessible strong-green text, and focus ring; verify calculated foreground contrast satisfies the specification.
- [x] 2.2 Map the existing learner primary, secondary, accent, progress, selection, and navigation states to the new semantic tokens, and verify the login, shell, dashboard, course, activity, learning-check, and chatbot views visibly inherit the palette.
- [x] 2.3 Replace learner-only standalone `text-primary` usages with the accessible strong-brand text token where required, and verify all normal-sized brand-colored text reaches a 4.5:1 contrast ratio against its rendered background.
- [x] 2.4 Audit learner components for exceptional hard-coded brand colors and semantic success states, migrate applicable values without conflating brand actions with success feedback, and verify warning and destructive states remain distinguishable without color-only meaning.

## 3. Regression Coverage and Validation

- [x] 3.1 Add or update focused tests for learner palette values, Poppins scoping, accessible foreground pairings, focus visibility, and admin-theme isolation; verify the targeted test files pass.
- [x] 3.2 Run `npm test`, `npm run typecheck`, and `npm run lint` in `admin-platform`, and verify all commands complete successfully.
- [x] 3.3 Inspect representative learner pages at desktop and mobile widths, including login, loading, navigation, course content, checks, and chatbot states; verify consistent branding, readable fallback behavior, keyboard focus, responsive continuity, and unchanged admin and embedded interfaces.

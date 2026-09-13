## Why

The learner-facing platform currently uses a neutral blue-and-Geist presentation that does not reflect the requested learning brand. Applying the supplied green and cyan palette with Poppins will give learner pages a consistent, recognizable identity while preserving readable, accessible interactions.

## What Changes

- Introduce a learner-specific visual identity using `#3AB664` as the primary brand color, `#66D2E3` as the secondary color, and `#B5E5F8` as the soft accent color.
- Use Poppins across learner-facing routes, including authenticated pages, loading states, and the learner login experience.
- Map the palette through the existing learner theme tokens so shared buttons, progress indicators, selections, navigation, cards, badges, and feedback states inherit the new identity consistently.
- Use accessible dark foreground colors on the supplied light and mid-tone brand colors instead of white text where contrast would be insufficient.
- Keep the admin interface, Moodle workshop styling, and embedded GraphSpace visualization palette outside this change.

## Capabilities

### New Capabilities

- `learner-interface-branding`: Defines the learner platform's scoped color palette, typography, accessibility, and isolation from non-learner interfaces.

### Modified Capabilities

None.

## Impact

- Affects learner-scoped styling in `admin-platform/src/app/globals.css` and font configuration within the Next.js application layout hierarchy.
- May require focused updates to learner components where a semantic theme token is not currently used.
- Adds Poppins through the existing `next/font/google` integration; no new npm package or API change is expected.
- Requires visual and accessibility regression checks for learner routes at desktop and mobile breakpoints.

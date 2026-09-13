## Purpose

Define a recognizable, accessible visual identity that applies consistently across the learner platform without changing the appearance of administrative or embedded specialist interfaces.

## ADDED Requirements

### Requirement: Learner interface uses the approved brand palette
The system SHALL present learner-facing application chrome and interactive states using `#3AB664` as the primary brand color, `#66D2E3` as the secondary brand color, and `#B5E5F8` as the soft accent color. Neutral colors MAY remain in use for text, borders, backgrounds, destructive states, and other roles not represented by the supplied palette.

#### Scenario: Learner opens an authenticated page
- **WHEN** a learner opens the overview, courses, opportunities, course detail, activity, or learning-check experience
- **THEN** primary actions and emphasis use the green brand color and secondary or soft-highlight states use the cyan and light-blue brand colors consistently

#### Scenario: Learner opens the login experience
- **WHEN** a learner visits the learner login page
- **THEN** the page uses the same learner brand palette as the authenticated experience

### Requirement: Learner typography uses Poppins
The system SHALL render learner-facing text in Poppins with the weights required for regular copy, labels, navigation, and headings, and SHALL provide a generic sans-serif fallback while the web font is unavailable.

#### Scenario: Learner views any learner route
- **WHEN** learner-facing content is rendered, including login and loading states
- **THEN** Poppins is the preferred font for visible interface text

#### Scenario: Web font is unavailable
- **WHEN** Poppins cannot be loaded
- **THEN** learner-facing text remains legible using the configured sans-serif fallback without blocking the page

### Requirement: Brand-colored content remains accessible
The system SHALL pair the supplied brand colors with foreground colors that meet WCAG AA contrast requirements for the rendered text size and SHALL retain visible focus indicators for keyboard-operated controls.

#### Scenario: Text appears on a brand-colored surface
- **WHEN** a label, button title, badge, or other text is rendered over one of the supplied brand colors
- **THEN** its foreground color provides at least a 4.5:1 contrast ratio for normal text or 3:1 for large text

#### Scenario: Learner navigates with a keyboard
- **WHEN** focus moves to an interactive learner control
- **THEN** the control presents a visible focus indicator distinguishable from its surrounding brand-colored surface

### Requirement: Learner branding is isolated from other interfaces
The system SHALL scope the new palette and typography to learner-facing routes and SHALL NOT restyle the administrative interface, Moodle workshop UI, or embedded GraphSpace visualizations.

#### Scenario: Administrator opens an admin route
- **WHEN** an administrator visits a non-learner application route
- **THEN** the existing admin typography and theme remain unchanged

#### Scenario: Learner opens embedded specialist content
- **WHEN** a learner opens an embedded Moodle workshop or GraphSpace visualization
- **THEN** the embedded interface retains its independently managed palette and typography

### Requirement: Learner branding remains consistent across viewport sizes
The system SHALL preserve the learner palette, typography, contrast, and interaction-state meanings across supported desktop and mobile layouts.

#### Scenario: Learner switches between desktop and mobile navigation
- **WHEN** the learner interface changes between desktop and mobile breakpoints
- **THEN** active navigation, primary actions, and readable typography retain the same visual meaning

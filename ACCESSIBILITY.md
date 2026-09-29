# Accessibility

Not a checklist item bolted on at the end — every fix below came from actually testing the running app,
not from reading a guideline. This doc exists to be checked against the real code, not taken on faith:
every claim names the exact file it lives in, and the automated pass below is reproducible.

## Automated audit (Sept 29): axe-core against the real running app

Beyond manual keyboard testing, an automated accessibility audit ([axe-core](https://github.com/dequelabs/axe-core),
the same engine behind Chrome DevTools' own Lighthouse/accessibility panel) was run with Playwright
against the actual built app in Docker — a real logged-in session, a real widget, both a desktop
(1440×900) and a mobile (390×844, touch-enabled) viewport — across `/login`, `/register`, `/terms`,
`/privacy`, `/help` and `/dashboard`.

**First run found 6 distinct real violations.** Every one was fixed and the audit re-run clean:

| Rule | Where | Fix |
|---|---|---|
| `region` / `landmark-one-main` | `/login`, `/register`, `/terms`, `/privacy`, `/help` — the whole page sat outside any landmark | `AuthLayout.tsx` now wraps its content in `<main className="contents">` (keeps the existing CSS grid/flex layout unaffected); `LegalPage.tsx` and `HelpCenterPage.tsx` likewise wrap their content in `<main>` |
| `aria-hidden-focus` (serious) | The closed AI assistant panel (`AiBubble.tsx`) had `aria-hidden="true"` while its buttons/input stayed in the Tab order — a keyboard user could focus controls that are invisible on screen | Added `inert={!open}` alongside `aria-hidden` — `inert` removes an element from both focus order and the accessibility tree at once, which `aria-hidden` alone doesn't |
| `color-contrast` (serious) | The RSS "newspaper" card's `.kicker` label and article timestamps sit on a light parchment background (`#f5efe3`); their text (`#8b5cf6`, `#8a7d70`) measured 3.69:1 and 3.49:1 — below WCAG AA's 4.5:1 for normal text | Darkened to `#6d28d9` and `#6b5f55` (same hue family, ~6.2:1 and ~5.4:1) in `morex.css`, applied everywhere those colors sit on a light card background (RSS card, GitHub daily-changes notebook card) |
| `heading-order` | The RSS lead article's `<h2>`(was `<h3>`) had no `<h2>` anywhere before it in the page, and the search popover's category labels were literal `<h6>` elements with nothing between them and the page's `<h1>` | Search popover labels (`Chrome.tsx`) changed from `<h6>` to a plain `<p className="res-label">` — they're transient UI labels inside a search dropdown, not real page sections, and shouldn't be in the heading outline at all; the RSS lead article's headline promoted from `<h3>` to `<h2>` |
| `landmark-unique` | The sidebar's two `<nav>` elements (`Chrome.tsx`) had no accessible name, so a screen reader announced two identical, indistinguishable "navigation" regions | Added `aria-label` to each (`Main navigation` / `Account`, translated) |

Re-running the exact same audit after the fixes: **0 violations, on every page, at both viewport sizes.**

Reproduce it: `poc/` has the pattern for a throwaway logged-in Playwright session (create a user via the
API, confirm via the token in `EmailVerificationToken`, `context.addCookies([{ name:
'dashboard_session', ... }])`); load `axe-core`'s bundled script into the page and call `window.axe.run()`.
Chromium needs `libnspr4`/`libnss3`/`libasound2` on a machine that doesn't already have them.

## Real bug found and fixed by hand: every type-ahead suggestion list was keyboard-unreachable

Crypto assets, GitHub repos, cities, countries, YouTube channels, the `custom_api` JSON explorer — every
one of them rendered its options as `<div role="option" onClick={...}>`, with no `tabIndex` and no
`onKeyDown`. `role="option"` alone doesn't make an element focusable or operable: without a way to Tab
onto it and press Enter/Space, configuring almost any widget was impossible without a mouse. axe-core
doesn't catch this class of bug (it can't tell whether Tab actually reaches something) — found by
navigating the app keyboard-only.

Fixed with one shared component, `Opt` (`frontend/src/components/morex/ParamFields.tsx`), used
everywhere a suggestion list is rendered:

```tsx
function Opt({ selected, onSelect, className = '', children }: { selected?: boolean; onSelect: () => void; className?: string; children: ReactNode }) {
  return (
    <div role="option" aria-selected={!!selected} tabIndex={0} className={`${selected ? 'on' : ''} ${className}`.trim()}
      onClick={onSelect} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}>
      {children}
    </div>
  )
}
```

Plus a matching `:focus-visible` style in `frontend/src/styles/morex.css` — the app turns off the
browser's default outline on its custom inputs elsewhere, so a keyboard user needs an explicit one back:

```css
.pf-list > div:focus-visible, .pf-tree div:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--a2); background: rgb(255 255 255 / .1); }
```

## Icon-only buttons carried a meaningless `aria-label`

Delete/edit/resize/close buttons had `aria-label="✕"` — the same glyph already shown on screen — so a
screen reader announced a character ("cross"), not an action. Replaced with real, translated words:
`W.delete` / `W.edit` / `W.resize` / `W.close` in `frontend/src/lib/i18n.ts` (all three languages), used in
`WidgetGrid.tsx`, `AiBubble.tsx`, `CityPicker.tsx`, `Modals.tsx`.

## Already in place

- Every `<img>` has an `alt` — empty (`alt=""`) for decorative images, real text for informative ones.
- Every modal is `role="dialog"` + `aria-modal="true"` (`Modals.tsx`, `Drawer.tsx`).
- `<html lang>` is kept in sync with the user's chosen language, not hardcoded to English
  (`document.documentElement.lang = lang` in `DashboardPage.tsx` and `AuthLayout.tsx`) — matters for how a
  screen reader pronounces the page.
- `@media (prefers-reduced-motion: reduce)` is respected on the animated pages (`index.css`,
  `morex.css`): the confirmation-page constellation, the falling stars, the refresh-countdown glow, the
  widget "stuck" pulse all turn off.
- Price/rate changes are never color-only: a ▲/▼ glyph carries the same information as the green/red
  (`widgetViews.tsx`'s `FxView`/`PriceView`) — color alone would fail for anyone who can't distinguish
  red from green.
- The world-clock city picker (`CityPicker.tsx`) already implements the ARIA combobox pattern properly —
  arrow-key navigation + Enter to pick, a `sel` index kept in sync with `aria-selected` — built that way
  from the start, not retrofitted.

## What's honestly still not verified

- **No test session with an actual screen reader** (NVDA, VoiceOver, TalkBack). axe-core checks the
  accessibility *tree* (roles, names, structure) very thoroughly, but it can't tell you how something
  actually *sounds* read aloud, or whether the reading order feels natural — that needs a human listening.
- **No test on a real mobile device or touch screen** — the audit above used Playwright's mobile
  viewport + touch emulation (a real, standard practice, not a guess), but never a physical phone.
- **Only the pages/states that were actually logged into and rendered were audited**: one RSS widget, no
  other widget kinds, no open modals (add/edit widget, profile, journal, avatar editor). The same classes
  of bug (missing landmark, heading skip, contrast) could exist in a widget kind or a modal that wasn't
  in this pass — the method above is fully reproducible for anyone who wants to extend it.

These are named here on purpose rather than left silent: if asked at the defense, the honest answer is
"here's the real automated audit, its exact output, and here's specifically what it can't check" — not a
claim of blanket compliance.

See also: [ARCHITECTURE.md](./ARCHITECTURE.md) for the rest of the technical documentation,
[PRIVACY.md](./PRIVACY.md) for what data this app collects.

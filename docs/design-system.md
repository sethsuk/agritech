# Farm app design system — "Field and sky"

Target users are farm workers outdoors in direct sunlight, many with impaired
vision, using Latin / Thai / Burmese. Flat UI: solid fills, clear boundaries, no
gradients, no shadows, no blur.

Tokens live in [`app/globals.css`](../app/globals.css) under `@theme` and are the
single source of truth. **Never hardcode a hex value in a component.**

## Two audiences, two rule sets

This app has two very different users, and the rules are scoped accordingly:

| | Worker flow | Manager UI |
|---|---|---|
| Context | Field, sunlight, gloves, low tech-literacy | Reviewing data, likely indoors |
| Type floor | **18px** (`text-lg`+) | 14px allowed — density is the point |
| Touch targets | **60px** (`h-15`) | **44px** (`min-h-11`) |
| Layout | One primary action per screen | Dense dashboards and tables are fine |

Manager UI inherits the palette, flat style and contrast rules — but **not** the
type floor or the 60px targets. A 7-column table cannot fit 375px at 18px.

## Color

All ratios measured against the page background `#FAF7F0`. Everything carrying
text clears **AAA (7:1)** except `muted`, deliberately **AA (4.6:1)**, which is
therefore restricted to incidental metadata.

| token | hex | contrast | use |
|---|---|---|---|
| `bg` | `#FAF7F0` | — | page — off-white, not pure white, to cut glare |
| `surface` | `#FFFFFF` | — | cards |
| `surface-alt` | `#F0EADE` | — | subtle fills |
| `surface-press` | `#E5DDCD` | — | pressed state |
| `line` | `#D9D0C1` | — | borders — **replaces every drop shadow** |
| `ink` | `#2B2318` | 14.47:1 | headings, key values |
| `body` | `#4A3F31` | 9.59:1 | labels, body copy |
| `muted` | `#7D6E59` | 4.62:1 | incidental metadata **only** |
| `primary` | `#1B5E20` | 7.87:1 on white | actions |
| `status` | `#01579B` | 7.40:1 on white | confirmations, info |
| `warning` | `#A62F0A` | 6.93:1 on white | alert tier 1 |
| `caution` | `#B45309` | 5.02:1 on white | alert tier 2 |

Each semantic color has `-press` (pressed), `-tint` (subtle fill) and `-ink`
(text on that tint) variants; every tint/ink pairing clears AAA.

**Solid fills always take white text.** WCAG AAA is 7:1 for normal text but
4.5:1 for large text (≥24px, or ≥18.66px bold) — since colored fills always carry
≥18px bold labels, they clear AAA-large comfortably.

### Colors are never the only signal

Roughly 8% of men have red-green color blindness. Pair color with an icon and a
text label — always.

This matters most for **alert tiers**: tier 1 (`warning`) and tier 2 (`caution`)
are close in hue and only 1.38 apart in luminance, so **the icon and label — not
the color — are what actually distinguish urgent from moderate.** Solid amber
dark enough to clear AAA turns brown and becomes indistinguishable from the
warning orange; that trade was made knowingly.

Keep `tierMeta` in `app/(manager)/dashboard/page.tsx` in sync with `tierBadge` in
`app/(manager)/alerts/page.tsx`.

### Ribbon colors are DATA, not semantics

`generation_color` (`red | blue | yellow | white`) describes a **physical colored
ribbon tied on a tree**. These collide with the semantic palette — blue ribbon vs
status blue, red ribbon vs warning, yellow ribbon vs caution.

They are separated by **shape, not hue**:

- **Ribbon colors** → only ever a **round swatch** beside a neutral label
  (`--color-ribbon-*`). Never a colored pill, never colored text.
- **Semantic colors** → only ever **rectangular** badges, banners or text.

A worker should never have to work out whether a blue thing is a status or a ribbon.

## Typography

One stack, per-script glyph substitution by the renderer. Never swap the whole
font per screen or language.

```
--font-sans: Noto Sans, Noto Sans Thai, Noto Sans Myanmar, system-ui, sans-serif
```

**Three weights: 400 / 600 / 700.** No light weights — they lose stroke
definition in sunlight and for low-vision readers. (The two-weight rule in the
original brief was relaxed to three; its stated rationale targeted thin weights,
which 600 is not.)

`line-height: 1.6` globally — Thai and Burmese stack vowel and tone marks above
and below the baseline and clip at tighter values.

Left-align body copy. No all-caps except short button labels. No italics at small sizes.

## Interaction

- **Touch targets:** 60px worker / 44px manager (see table above).
- **Radius:** 8px (`rounded-lg`) for cards, buttons, inputs. Badges/pills and
  ribbon swatches stay `rounded-full` — pill shape reads as "status", and round
  swatches mirror the physical ribbon.
- **Icons always paired with a label** for content actions. Header chrome
  (back, logout) may stay icon-only with an `aria-label` — a back chevron is
  near-universal and labelling it forces the header to two rows at 375px.
- **No `window.confirm()`.** Use [`components/ConfirmDialog.tsx`](../components/ConfirmDialog.tsx):
  full-width confirm/cancel, no small "X", no tap-outside-to-dismiss — so nothing
  can be dismissed by an accidental gloved touch.
- **No hamburger menus, no hidden gestures.** Visible bottom tab bar, ≤4 items.
- **Disabled** stays conventionally faded.
- **Language toggle** appears on the login page and the worker home (`/scan`)
  only — three 60px pills do not fit alongside a back button and title.

## Internationalization

- **Burmese requires the webfont.** Before Noto Sans Myanmar was loaded, Burmese
  fell back to whatever the device had — tofu boxes on hardware without a Myanmar
  font. Shipping the Unicode webfont is what makes it render reliably.
- **Zawgyi is deferred, not dismissed.** Myanmar officially migrated to Unicode
  in Oct 2019, but adoption is uneven and older budget devices may still be
  Zawgyi-only. The webfont neutralizes most of the risk for text *we* render; the
  residual risks are (a) a flash of device-fallback text before the webfont loads
  on slow connections, and (b) Zawgyi-encoded input, whose only realistic surface
  is the worker display-name field. **Revisit with Google's `myanmar-tools` if
  real Zawgyi users appear.** Test on actual low-end devices before launch.
- **No Thai or Burmese copy has been reviewed by a native speaker.** Everything
  in `lib/i18n/dictionary.ts` and `lib/i18n/varieties.ts` is a layout reference.
  This is a shipping blocker for the Burmese UI.
- Variety names are **transliterations**, not translations. `trees.variety`
  stores the canonical romanized name; only the label is localized. Storing a
  localized name would fragment the same cultivar across languages.

## Deliberately not adopted

- **Offline-first.** It collides with the fraud model: `start-log` issues a
  server-signed token deciding photo requirements, and timing validation compares
  `form_opened_at` / `qr_scanned_at` / `submitted_at`. Queuing submissions would
  make `submitted_at` meaningless and let a worker go offline to dodge photo
  audits. Farm has signal throughout; revisit only as its own spec.
- **Voice/audio prompts.** Worth considering, out of scope for now.

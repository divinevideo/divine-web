# Divine Web — Brand Alignment Report

Comparing the current divine-web UI to the official brand guidelines (`docs/brand/`), with reference to how `../divine-badges` executes the brand better.

---

## TL;DR

Divine-web has the **foundations right** (brand colors tokenized, both brand fonts loaded, dark-green dark theme) but the **execution reads generic**. The biggest misses:

1. **Icons are Lucide, not Phosphor** — affects ~100 components and is the single largest visual mismatch.
2. **Gradients everywhere** on key pages (landing, messages, 404) — brand explicitly forbids gradients.
3. **Microcopy is corporate** ("uploaded successfully", "No content available") instead of Playful Rebel ("Your loop is live", "Nada. Try something different?").
4. **No visual personality** — missing the chunky offset shadows, slight rotations, accent-color-per-type card system that makes divine-badges feel human-made.
5. **All-caps tracking-wide section headers** scattered through components — explicit brand don't.

Fonts/colors are declared correctly in `src/index.css` and `tailwind.config.ts`; the gap is in how they're *used*.

---

## What divine-badges Does Better (and Worth Stealing)

From `/Users/rabble/code/divine/divine-badges/assets/`:

### 1. Chunky offset shadows as house style
```css
.card { box-shadow: 6px 6px 0 var(--green); border: 2px solid var(--dark); }
.card.week  { box-shadow: 6px 6px 0 var(--pink); }
.card.month { box-shadow: 6px 6px 0 var(--violet); }
```
Hard offset shadows (not blur) in accent colors. Feels hand-screen-printed, not Figma-neutral. Different accent shadow per card *type* signals intent without clutter.

### 2. Hover = translate + shadow grow
```css
.primary:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0 var(--dark); }
```
Button literally lifts off the page. Punk-playful physicality.

### 3. Deliberate rotation on callouts
```css
.sticker { transform: rotate(-3deg); }
```
Small tilt (2–4°) on badges/stickers. Signals "made by humans, not a design system."

### 4. Empty-state microcopy with direction
> "No badges awarded here yet. Keep looping — we check every UTC morning."

Tells users *why* it's empty and *what to do*. Never "No data available."

### 5. Gradient overlays on hero art — but only on art, never on layout surfaces
Badges use radial gradients *inside* illustration cards. Layout backgrounds stay solid Dark Green. This is consistent with the brand rule (gradients on imagery/illustration are fine; flat layout surfaces must stay solid).

---

## Concrete Gaps in divine-web

### Typography / Layout

| Gap | Where | Brand rule |
|---|---|---|
| All-caps section headers | `PinnedVideosSection.tsx`, `LanguageMenu.tsx`, `ApplePodcastEmbed.tsx`, `ProfileBadges.tsx` | No all-caps in headlines or paragraphs |
| Headings don't enforce Bold/Extra Bold | `src/index.css:203` applies Bricolage to `h1–h6` but no weight | Bricolage headlines are Bold / Extra Bold |
| HSL color drift from hex | `src/index.css:24–50` (Dark Green hue off by 2°, Off White hue off by 10°, etc.) | Use exact hex values |

### Color / Surfaces

| Gap | Where | Brand rule |
|---|---|---|
| FOUC fallback uses `#09090b` (generic near-black) | `index.html:87` | Dark surface should be `#07241B` |
| Gradients on layout | `LandingPage.tsx`, `MessagesPage.tsx`, `ConversationPage.tsx`, `NotFound.tsx` | "Don't create or use gradients" |

### Iconography

| Gap | Where | Brand rule |
|---|---|---|
| Lucide React used everywhere (~100 components) | `package.json:72` → `lucide-react` | Phosphor Icons (phosphoricons.com) is the specified system |

### Voice

| Current | Brand (Playful Rebel) |
|---|---|
| "Profile picture uploaded successfully" | "New face. Looking good." |
| "Your feed is empty" | "Nothing looping yet. Go find your people." |
| "List has been created successfully" | "List's up. Start stacking." |
| "No results found for your query" | "Nada. Try something different?" |

### Visual personality (missing across the board)
- No chunky offset shadows — everything uses default Tailwind blur shadows
- No accent-color variation on card types
- No micro-rotations, no stickers
- Buttons are flat/standard shadcn — no lift on hover, no thick borders

---

## What's Already Good — Don't Break

- `src/index.css:24–50` — brand colors are actually tokenized (`--brand-green`, `--brand-dark-green`, etc.) with light/dark mode mapping
- `index.html:54` — both Bricolage Grotesque and Inter are already loaded from Google Fonts
- `tailwind.config.ts:23` — Inter correctly set as default sans
- `src/index.css:103–183` — dark mode background actually uses Dark Green (the real one)
- `button-variants.ts` — brand-green/brand-dark-green hover states already wired
- No flat vector illustrations, no right-aligned text

---

## Three Proposed Directions

You asked to *explore*, so here are three scoped options, smallest to largest. Pick one (or mix) before implementation.

### Option A — "Polish Pass" (1–2 days)
Smallest scope. Fix brand rule violations, leave structure untouched.
- Kill gradients on layout surfaces (4 pages)
- Fix all-caps section headers (4 components)
- Correct HSL drift so tokens match exact hex
- Fix `#09090b` FOUC fallback → `#07241B`
- Enforce `font-bold` / `font-extrabold` on `h1–h4`
- Rewrite ~6 pieces of corporate microcopy to Playful Rebel
- **Does not** touch icons. **Does not** add new visual personality.

**Good if**: you want to ship a quick compliance pass and iterate later.

### Option B — "Personality Pass" (1 week) ★ recommended
Option A + inject the divine-badges visual personality *without* a full refactor.
- Everything in Option A
- Introduce a new button variant `brand-sticker` (thick border + chunky offset shadow, lift on hover) used on primary CTAs
- Introduce a `brand-card` utility: 2px Dark Green border, 22px radius, optional accent shadow
- Apply to ≤ 10 high-visibility surfaces: VideoCard, ProfileHeader, primary buttons on landing, upload form, list create dialog
- Phase microcopy rewrite across empty states + success toasts (not exhaustive yet)
- **Does not** replace Lucide (deferred to Option C or follow-up)

**Good if**: you want a visible brand identity shift users can feel, without a 100-file icon swap.

### Option C — "Full Brand Refresh" (2–3 weeks)
Option B + the Lucide → Phosphor migration and a pass over every surface.
- Everything in Option B
- Migrate all `lucide-react` imports to `@phosphor-icons/react` (find-and-replace + visual QA across every view)
- Apply brand-card/brand-sticker to all relevant surfaces, not just top 10
- Full microcopy audit and rewrite (empty states, toasts, errors, tooltips)
- Landing page rebuild (not just de-gradient — actually make it feel like the manifesto)
- Consider illustration/sticker assets to match divine-badges' "collectible" feel on profile, empty states, trending pages

**Good if**: this is a proper design moment and you want divine-web to look and feel like a sibling of divine-badges.

---

## Recommendation

**Option B, staged.** Foundation is already sound, so the ROI is highest on visible personality (buttons, cards, microcopy) rather than a full Lucide migration. Lucide → Phosphor can follow as its own PR — it's mechanical and low-risk once the design language is set.

**Next step**: pick a direction, and I'll write an implementation plan for it.

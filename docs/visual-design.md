# Visual Design

Premium, calm, and focused — a conversational creative studio for long sessions. Modern and alive when switching Content Format, never flashy or corporate.

→ Layout and behavior: [Frontend Architecture](./frontend-architecture.md)

---

## Design Philosophy

| Principle | Meaning |
|-----------|---------|
| **Spacious but focused** | Output Frame gets breathing room; Pipeline Navigation and Input Bar stay secondary but always accessible |
| **Dark-first** | Easy on the eyes during long creative sessions |
| **Mode-aware, not mode-loud** | Long = cooler indigo; Short = warmer violet — subtle accent shifts, not full theme swaps |
| **Continuous flow** | Viewport-locked shell (`h-screen overflow-hidden`); scroll only inside view panels |

**Overall feel:** Calm, modern creative tool — not a corporate dashboard.

---

## Color Palette

**Primary recommendation:** Deep Charcoal base + Indigo (Long) + Violet (Short).

### Core tokens

| Element | Name | Hex | Tailwind (suggested) | Usage |
|---------|------|-----|----------------------|-------|
| Background (main) | Deep Charcoal | `#0F0F12` | `bg-[#0F0F12]` or custom `--bg-main` | App shell |
| Surface / cards | Charcoal surface | `#1A1A1F` | Output Frame, Pipeline Navigation pill |
| Text primary | Off-white | `#F8F8F8` | `text-[#F8F8F8]` | Headings, script body, primary labels |
| Text secondary | Muted gray | `#A1A1AA` | `text-[#A1A1AA]` | Descriptions, helper copy, placeholders |
| Border / subtle | Dark gray | `#27272A` | `border-[#27272A]` | Dividers, inactive chip borders |
| Accent — Long | Electric Indigo | `#6366F1` | `indigo-500` | Active buttons, Long mode highlights |
| Accent — Short | Vibrant Violet | `#A855F7` | `purple-500` | Short mode emphasis, energetic accents |
| Success / active | Soft teal | `#14B8A6` | `teal-500` | Completed states, **Add Audio** when on |

### Why this palette

- Dark enough for extended use without eye strain
- Indigo reads creative + tech-forward (Long-form, structured)
- Violet gives Short mode a hook-first, energetic personality
- High contrast for readability on charcoal surfaces

### Mode differentiation

Apply accent via CSS variables toggled by `contentFormat`:

```css
:root, [data-format="long"] {
  --accent: #6366F1;
  --accent-muted: rgba(99, 102, 241, 0.15);
}
[data-format="short"] {
  --accent: #A855F7;
  --accent-muted: rgba(168, 85, 247, 0.15);
}
```

Set `data-format` on `StudioShell` from `useProjectStore.contentFormat`. Affects:
- Content Format active segment fill
- Output Frame border glow (subtle)
- Recommended Quick Control highlight ring
- Focus rings on Input Bar

### Alternative accents (reference only)

| Style | Accent | Vibe | Best for |
|-------|--------|------|----------|
| Cool & professional | `#3B82F6` Blue | Clean, trustworthy | General use |
| Creative / artistic | `#8B5CF6` Violet | Modern, expressive | Music / creative content |
| Warm & energetic | `#F43F5E` Rose | Bold, punchy | High-energy Shorts |
| Minimal | `#22D3EE` Cyan | Futuristic, clean | Tech-heavy feel |

**Locked choice:** Deep Charcoal + Indigo base; Short mode shifts toward Violet.

---

## Typography

| Role | Font | Notes |
|------|------|-------|
| UI + body | **Inter** or **Satoshi** | Clean, modern, excellent at small sizes |
| Monospace (optional) | `ui-monospace` | Script timestamps, metadata only |

```ts
// app/layout.tsx — example
import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
```

| Scale | Size | Usage |
|-------|------|-------|
| `text-xs` | 12px | Content Format label, chip hints |
| `text-sm` | 14px | Pipeline nav chips, secondary text |
| `text-base` | 16px | Input Bar, script body |
| `text-lg` | 18px | Output Frame section titles |
| `text-xl` | 20px | Project name in header |

---

## Viewport & scroll model

| Rule | Implementation |
|------|----------------|
| **Viewport lock** | `StudioShell`: `h-screen overflow-hidden` — app = exactly one screen, no body scroll |
| **Dynamic canvas** | `OutputFrame`: `flex-1 min-h-0` — fills space between header and bottom dock (no rigid `min-h-[65vh]`) |
| **Internal scroll** | Each view panel inner wrapper: `h-full min-h-0 overflow-y-auto` |
| **Fixed chrome** | Header, `ControlDock`, Input Bar: `shrink-0` |

```tsx
// Flex column — Output Frame absorbs all leftover height
<div className="flex h-screen flex-col overflow-hidden">
  <header className="shrink-0" />
  <main className="min-h-0 flex-1" />   {/* Output Frame */}
  <footer className="shrink-0" />     {/* dock + input */}
</div>
```

On resize, the canvas grows/shrinks; bottom controls stay pinned; content scrolls inside the active view only.

---

## Component Visual Specs

### Thin header

| Property | Value |
|----------|-------|
| Height | `h-12` to `h-14` — minimal |
| Background | Transparent or `bg-[#0F0F12]/80` with `backdrop-blur-sm` |
| Border | `border-b border-[#27272A]` optional |
| Content | Project name only (left or centered) |

Keeps focus on the Output Frame. Content Format lives in the bottom control stack, not here.

### Content Format control

| Property | Value |
|----------|-------|
| Placement | **Centered directly above** the Pipeline Navigation floating pill |
| Type | Segmented pill with micro-label "Content Format" |
| Segments | `Long` + `Film` icon · `Short` + `Smartphone` icon |
| Active Long | Indigo fill `#6366F1` |
| Active Short | Violet fill `#A855F7` |
| Animation | Sliding background indicator, `transition-all duration-200` |
| Spacing | `mb-2` gap between toggle and pipeline pill below |

Grouped with Pipeline Navigation in the bottom dock — format and pipeline feel like one control surface.

### Output Frame (hero canvas)

| Property | Value |
|----------|-------|
| Layout | `flex-1 min-h-0` — fills remaining viewport between header and bottom dock |
| Internal padding | `p-6` on scrollable inner wrapper (not the flex shell) |
| Surface | `bg-[#1A1A1F]`, `rounded-3xl` |
| Elevation | Soft layered shadow — `shadow-xl shadow-black/20` |
| Glass (optional) | `backdrop-blur-md bg-[#1A1A1F]/90` for floating feel |
| Border | `border border-[#27272A]`; mode accent: `border-[var(--accent)]/20` |
| Scroll | **None on frame shell** — `overflow-y-auto` only on inner view container |

Feels like a real creative canvas — elevated from the shell, sized to available space.

**Per view (all use internal scroll wrapper):**
- `script` — readable column, `max-w-3xl` centered, off-white text, `overflow-y-auto`
- `scenes` — grid with `gap-4`, rounded-2xl image cards. Includes custom upload buttons, download anchors, individual regeneration spinners, and a scrolling stock drawer at the bottom.
- `video` — 16:9 or 9:16 video compilation storyboard gallery. Includes custom uploads, download triggers, and stock drawer search panels.
- `ffmpeg` — 16:9 or 9:16 render output video player. Features a clean, hover-triggered control overlay (Download and Regenerate buttons) positioned directly inside the top-right corner of the video frame.
- `trends` / `facts` — card/list content scrolls inside panel.
- `seo` — structured metadata publisher. Includes title cards (with Copy trigger), description editor (with Copy Description button), tag pills (with `#` prefix individual and Copy All triggers), and a thumbnail preview card with hover action overlays (download, upload, regenerate) and prompt editor.
- Loading — skeleton shimmer inside frame (`animate-pulse` on `#27272A` blocks)

### Pipeline Navigation (floating pill)

All **six pipeline steps always visible** in fixed sequential order:

`Explore Trends` → `Fact Finder` → `Write Script` → `Scene Pictures` → `Scene Videos` → `SEO & Publish` → `[Add Audio]`

| Property | Value |
|----------|-------|
| Position | In bottom `ControlDock` (`shrink-0`), above Input Bar — not `fixed`/`bottom-*` (dock is part of flex column) |
| Layout | `flex flex-row flex-nowrap items-center justify-center gap-1` — horizontal pipeline |
| Width | `max-w-5xl` or full width with horizontal scroll on narrow viewports |
| Shape | `rounded-full` or `rounded-3xl` pill |
| Surface | Glassmorphism: `bg-[#1A1A1F]/80 backdrop-blur-xl` |
| Shadow | Strong but soft: `shadow-2xl shadow-black/40` |
| Border | `border border-[#27272A]/50` |
| Padding | `px-4 py-2` |
| Separators | Muted `→` or `·` between steps (`text-[#27272A]`) |

**Pipeline chips (all six always shown):**
- Default: `bg-transparent border border-[#27272A] text-[#A1A1AA]` — **never disabled**
- Active (`activeView` match): `bg-[var(--accent-muted)] border-[var(--accent)]/40 text-[#F8F8F8]`
- Completed (optional): small dot or check — informational only
- Hover: subtle brighten

**Add Audio toggle** — after step 6, visually separated (`ml-2 border-l border-[#27272A] pl-2`):
- Off: outline style, muted
- On: `bg-teal-500/15 border-teal-500/50 text-teal-400`

### Input Bar

| Property | Value |
|----------|-------|
| Position | In bottom dock (`shrink-0`), `max-w-3xl mx-auto mb-4` |
| Shape | `rounded-2xl` or `rounded-full` |
| Surface | `bg-[#1A1A1F] border border-[#27272A]` |
| Focus | `ring-2 ring-[var(--accent)]/50 ring-offset-2 ring-offset-[#0F0F12]` |
| Padding | `px-4 py-3` |

Chat-like, familiar — `Upload` icon on the left (opens native file picker directly), text placeholder center, and send arrow on the right. Attached files render as a capsule filename badge with a `×` dismiss option inside the bar.

---

## Spacing & Shape

| Token | Value | Usage |
|-------|-------|-------|
| Page padding | `p-6` | Studio shell edges |
| Component gap | `gap-4` | Chip rows, gallery grids |
| Corner radius — large | `rounded-3xl` | Output Frame, outer pills |
| Corner radius — medium | `rounded-2xl` | Input Bar, image cards |
| Corner radius — small | `rounded-full` | Chips, toggle segments |

**Shadows:** Soft layered only — avoid heavy drop shadows that feel dated.

```
shadow-sm   → subtle card lift
shadow-xl   → Output Frame
shadow-2xl  → Pipeline Navigation floating pill
```

---

## Layout Reference

```
┌─────────────────────────────────────────────────────────────┐  h-screen overflow-hidden
│  Project Name                                               │  shrink-0
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────┐  │
│  │         OUTPUT FRAME · flex-1 min-h-0               │  │  internal scroll
│  │         bg #1A1A1F · rounded-3xl                    │  │
│  └───────────────────────────────────────────────────────┘  │
│              Content Format  [ Long ▎ Short ]               │  shrink-0 dock
│         ╭─────────────────────────────────────────────────╮ │
│         │ Trends → Facts → Script → Scenes → Video → SEO  │ │
│         │                                    [Add Audio ●]│ │
│         ╰─────────────────────────────────────────────────╯ │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ [Upload] │  What do you want to do next?         →  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Visual Concepts

Three reference directions aligned with this spec:

| # | Concept | Shows |
|---|---------|-------|
| 1 | **Full studio layout** | Thin header, Output Frame, Content Format + full 6-step pipeline pill, Input Bar |
| 2 | **Pipeline Navigation detail** | All six steps in order with separators + Add Audio at end |
| 3 | **Short mode gallery** | Output Frame in 9:16 scene grid with violet accents — energetic Short personality |

Store concept images in `docs/assets/visual/` when available (e.g. `studio-layout.png`, `quick-controls.png`, `short-gallery.png`).

---

## Tailwind Setup (implementation)

```ts
// tailwind.config.ts — extend theme
theme: {
  extend: {
    colors: {
      studio: {
        bg: "#0F0F12",
        surface: "#1A1A1F",
        border: "#27272A",
        "text-primary": "#F8F8F8",
        "text-secondary": "#A1A1AA",
        accent-long: "#6366F1",
        accent-short: "#A855F7",
        success: "#14B8A6",
      },
    },
    borderRadius: {
      studio: "1.5rem", // rounded-3xl equivalent
    },
    boxShadow: {
      studio: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
      canvas: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
    },
  },
},
```

---

## Summary

| Element | Spec |
|---------|------|
| Theme | Dark-first — Deep Charcoal `#0F0F12` |
| Main accent | Indigo `#6366F1` (Long) |
| Short accent | Violet `#A855F7` |
| Pipeline Navigation | 6-step glass pill, all steps always visible |
| Output Frame | `flex-1 min-h-0` — dynamic fill, internal scroll only |
| Typography | Inter or Satoshi |
| Overall feel | Calm, modern, creative — premium without flash |

Cross-reference: mode accent behavior ties to [Content Format — Default & Adaptation](./frontend-architecture.md#default--adaptation-behavior) and [UX Enhancements — visual polish](./frontend-architecture.md#ux-enhancements).

# StudentOS — Design System Standards

**Version:** 1.0  
**Scope:** All UI components, pages, and consumer surfaces  
**Principle:** Mobile-first, creator-focused, educationally trustworthy

---

## 1. Color Token System

All colors use CSS custom properties defined in `index.css`. **Never use hardcoded hex/RGB values in components.**

### Primary Palette

| Token | Usage | Light Value | Dark Value |
|---|---|---|---|
| `bg-background` | Page backgrounds | `hsl(220 20% 98%)` | `hsl(222 47% 6%)` |
| `bg-card` | Card surfaces | `hsl(0 0% 100%)` | `hsl(222 40% 9%)` |
| `text-foreground` | Primary text | `hsl(222 47% 9%)` | `hsl(220 14% 93%)` |
| `text-muted-foreground` | Secondary text, labels | `hsl(220 10% 50%)` | `hsl(220 10% 55%)` |
| `bg-primary` / `text-primary` | CTAs, active nav | Indigo `245 70% 52%` | `245 70% 65%` |
| `bg-accent` / `text-accent` | Highlights, badges | Violet `270 80% 60%` | `270 80% 65%` |
| `bg-destructive` | Errors, danger | `0 84% 60%` | `0 70% 50%` |
| `border-border` | Dividers, card borders | `hsl(220 13% 90%)` | `hsl(222 35% 16%)` |

### Brand Semantic Colors (Tailwind `brand.*`)

```
brand-indigo  — primary actions, active states
brand-violet  — secondary, accent, live indicators
brand-emerald — success, earnings, positive signals
brand-amber   — warnings, pending states, gold badges
brand-rose    — destructive, moderation, alerts
```

### Rule: Never construct color classes dynamically.
```jsx
// ✅ CORRECT
<div className="bg-primary text-primary-foreground" />

// ❌ WRONG — Tailwind cannot scan this
<div className={`bg-${color}-500`} />
```

---

## 2. Typography Standards

### Font Stack

| Font | Use Cases | Class |
|---|---|---|
| `Inter` | Body, labels, data, inputs | `font-inter` (default body) |
| `Plus Jakarta Sans` | Headings (h1–h4), display text | `font-jakarta` (auto on h1–h6 via base layer) |

### Scale

| Role | Class | Weight | Size |
|---|---|---|---|
| Display / Hero | `text-3xl font-jakarta font-bold` | 700 | 30px |
| Page Title | `text-2xl font-jakarta font-semibold` | 600 | 24px |
| Section Header | `text-xl font-jakarta font-semibold` | 600 | 20px |
| Card Title | `text-base font-jakarta font-semibold` | 600 | 16px |
| Body (primary) | `text-sm text-foreground` | 400 | 14px |
| Body (secondary) | `text-sm text-muted-foreground` | 400 | 14px |
| Caption / Label | `text-xs text-muted-foreground` | 400 | 12px |
| Stat / Number | `text-2xl font-jakarta font-bold tabular-nums` | 700 | 24px |

---

## 3. Spacing & Layout

### Grid System
- **Mobile:** single column, full width, `px-4`
- **Tablet (md):** two-column feeds, `px-6`
- **Desktop (lg+):** three-zone layout (sidebar + main + right panel)

### Spacing Scale (Tailwind defaults — use these only)

```
xs:  gap-1, p-1   (4px)    — icon padding, tight labels
sm:  gap-2, p-2   (8px)    — inline elements, badges
md:  gap-3, p-3   (12px)   — card inner padding
lg:  gap-4, p-4   (16px)   — section padding, card default
xl:  gap-6, p-6   (24px)   — page section padding
2xl: gap-8, p-8   (32px)   — hero sections
```

### Card Anatomy (Standard)
```jsx
// All feed cards, profile cards, list items use this pattern:
<div className="feed-card p-4">           {/* defined in index.css */}
  <CardHeader />                           {/* spacing: pb-2 */}
  <CardContent />                          {/* spacing: py-2 */}
  <CardFooter />                           {/* spacing: pt-2 border-t border-border/50 */}
</div>
```

### `feed-card` utility (index.css)
```css
.feed-card {
  @apply bg-card rounded-2xl border border-border/60 shadow-sm
         transition-shadow duration-200 hover:shadow-md;
}
```

---

## 4. Component Conventions

### Button Hierarchy

| Variant | Usage | Class Pattern |
|---|---|---|
| `default` | Primary CTA | `bg-primary text-primary-foreground` |
| `secondary` | Secondary actions | `bg-secondary text-secondary-foreground` |
| `outline` | Tertiary, toggles | `border border-border bg-transparent` |
| `ghost` | Icon buttons, nav items | `hover:bg-muted` |
| `destructive` | Delete, ban, remove | `bg-destructive text-destructive-foreground` |

**Icon buttons:** Always include `aria-label`. Size: `h-8 w-8` or `h-9 w-9` for touch targets (min 44px effective).

### Avatar Sizes (standardized)

| Context | Size Class |
|---|---|
| Comment / notification | `h-7 w-7` |
| Feed card author | `h-9 w-9` |
| Profile preview | `h-10 w-10` |
| Creator header | `h-14 w-14` |
| Full profile | `h-20 w-20` or `h-24 w-24` |

### Badge Semantics

| Variant | When |
|---|---|
| `default` | Status, categories |
| `secondary` | Neutral labels |
| `outline` | Tags, counts, metadata |
| `destructive` | Errors, bans, removed |

---

## 5. Loading States

### Rule: Every async operation must have a loading state. Never show empty content without feedback.

```jsx
// Standard skeleton pattern
import { Skeleton } from "@/components/ui/skeleton";

// Feed card skeleton
<div className="feed-card p-4 space-y-3">
  <div className="flex items-center gap-3">
    <Skeleton className="h-9 w-9 rounded-full" />
    <div className="space-y-1 flex-1">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-3 w-20" />
    </div>
  </div>
  <Skeleton className="h-4 w-full" />
  <Skeleton className="h-4 w-3/4" />
  <Skeleton className="h-32 w-full rounded-xl" />
</div>

// Inline spinner (small operations)
<div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin" />

// Full page loader (route transition)
<div className="flex items-center justify-center h-64">
  <div className="w-6 h-6 border-2 border-border border-t-primary rounded-full animate-spin" />
</div>
```

---

## 6. Animation Rules

### Allowed Animations (from `tailwind.config.js` keyframes)

| Name | Use Case |
|---|---|
| `animate-fade-in` | Modal/panel appear, notification toast |
| `animate-scale-in` | Dropdown, popover, context menu |
| `animate-slide-up` | Mobile sheets, bottom panels |
| `animate-pulse` | Loading placeholders (Skeleton default) |
| `animate-spin` | Spinner indicators only |
| `animate-pulse-dot` | Live indicator dot |

### Framer Motion — When to Use

- Use `framer-motion` for: list item enter/exit, feed card appear, gesture-based interactions
- Do NOT use framer-motion for: loading spinners, hover states, color transitions (CSS is faster)
- Always use `AnimatePresence` when conditionally removing animated elements

```jsx
// Standard list item pattern
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -8 }}
  transition={{ duration: 0.15 }}
>
```

### Performance Rules
- No animation on elements with `will-change: auto` (browser default)
- Add `will-change: transform` only to animated elements that move > 60fps
- Never animate `width`, `height`, `top`, `left` — animate `transform` and `opacity` only

---

## 7. Modal System

### Standard Pattern: Use `Dialog` from shadcn/ui

```jsx
// Never create custom modal implementations
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Mobile: use Sheet (slides up from bottom)
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
```

### When to use Dialog vs Sheet

| Component | Use Case |
|---|---|
| `Dialog` | Confirmation, forms, detailed views (desktop-native) |
| `Sheet` | Mobile-first panels, media viewers, action menus |
| `Drawer` (vaul) | Complex mobile flows with drag-to-dismiss |
| `AlertDialog` | Destructive action confirmation only |

---

## 8. Accessibility Standards

### Required
- All interactive elements: `focus-visible:ring-2 focus-visible:ring-ring`
- All images: `alt` attribute (non-decorative) or `alt=""` + `aria-hidden="true"` (decorative)
- All icon buttons: `aria-label` describing the action
- All form inputs: paired `<label>` (use shadcn `Label` component)
- Color contrast: WCAG AA minimum (4.5:1 for text, 3:1 for large text)

### Keyboard Navigation
- Modal/Dialog: focus trap enforced by Radix UI (shadcn Dialog) — do not override
- Dropdown: arrow key navigation via Radix UI — do not override
- Feed: Tab-navigable card actions

### Screen Reader
- Live regions for real-time updates: `aria-live="polite"` on notification count
- Loading states: `aria-busy="true"` on loading containers
- Dynamic content: `aria-label` on icon-only navigation items

---

## 9. Mobile Consistency Rules

### Touch Targets
- Minimum 44×44px effective touch area for all interactive elements
- Use `p-3` (12px) minimum padding on icon buttons to reach 44px
- Bottom nav items: full-width touch zone, at least 56px height

### Safe Areas
- Bottom nav: always `pb-safe` (env safe area for iPhone notch)
- Top content: `pt-safe` when under status bar
- Modal: account for keyboard height on iOS (CSS `env(keyboard-inset-height)`)

### Scroll Patterns
- Feeds: `overflow-y-auto scrollbar-thin` (custom thin scrollbar, hidden on mobile)
- Horizontal carousels: `overflow-x-auto scrollbar-hide snap-x snap-mandatory`
- Pull-to-refresh: not implemented — use manual refresh button (simpler, more reliable)

---

## 10. Creator-Specific UX Conventions

### Creator Verification Badge
- `verified` educators: blue check icon (`BadgeCheck` from lucide, `text-primary`)
- `elite` creators: gold/amber check (`text-brand-amber`)
- Never show unverified badge — absence = unverified

### Creator Stats Display
- Always show in `tabular-nums` font feature
- Format: `1.2k` for > 999, `12.5k` for > 9,999, `1.2M` for > 999,999
- Positive change: `text-brand-emerald` with `↑` prefix
- Negative change: `text-destructive` with `↓` prefix

### Live Indicator
```jsx
<span className="flex items-center gap-1.5">
  <span className="h-2 w-2 rounded-full bg-destructive animate-pulse-dot" />
  <span className="text-xs font-medium text-destructive">LIVE</span>
</span>
```

### Gift Animation
- Gift animations overlay feed/live at `z-50`
- Duration: 2.5s, then fade out
- Never block interaction — pointer-events: none during animation
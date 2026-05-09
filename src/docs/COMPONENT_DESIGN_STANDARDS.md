# StudentOS Component Design Standards
**High-Fidelity, Reusable Interface Specifications**

---

## 1. ATOMIC COMPONENT HIERARCHY

```
Atoms (Smallest)
├─ Button
├─ Badge
├─ Icon
├─ Avatar
├─ Input Field
└─ Label

Molecules (Combined Atoms)
├─ Card Header (Avatar + Name + Menu)
├─ Form Group (Label + Input + Error)
├─ Notification Item (Icon + Text + Action)
└─ Progress Bar (Bar + Label + Percentage)

Organisms (Complex Components)
├─ Feed Card (Header + Media + Actions)
├─ Creator Profile (Avatar + Bio + Stats)
├─ Messaging Thread (Messages + Input)
└─ Wallet Dashboard (Balance + Transactions)

Templates (Page Layouts)
├─ Feed Page (Navigation + Cards + Sidebar)
├─ Profile Page (Header + Tabs + Content)
└─ Chat Page (Sidebar + Messages + Panel)

Pages (Full Features)
├─ Home (Feed)
├─ Learn (Study Hub)
├─ Groups (Messaging)
├─ Marketplace
└─ Profile
```

---

## 2. BUTTON COMPONENT SPECIFICATIONS

### Anatomy
```
[icon?] [text] [icon?]
```

### Variants

**Primary Button**
```
Background: --primary
Text: white, bold (font-semibold)
Border: none
Padding: 12px 16px (py-3 px-4)
Height: 40px
Border Radius: 12px (rounded-lg)
Font Size: 14px (body-sm)
Hover: bg-primary-dark, shadow-lg
Active: scale 0.98, shadow-inset
Disabled: bg-muted, text-muted, no pointer
Focus: 2px ring-primary ring-offset-2
```

**Secondary Button**
```
Background: --card
Text: --foreground, font-semibold
Border: 1px solid --border
Padding: 12px 16px
Height: 40px
Hover: bg-card-hover, border-border-light
Active: scale 0.98
Focus: ring-primary ring-offset-2
```

**Ghost Button**
```
Background: transparent
Text: --foreground or --primary
Border: none
Padding: 12px 16px
Hover: bg-muted/30
Active: scale 0.98
No focus ring (text color provides feedback)
```

**Icon Button**
```
Size: 40px × 40px
Background: transparent
Icon: 20px, --foreground or --primary
Hover: bg-muted/30
Active: scale 0.95
Border Radius: 12px
Focus: 2px ring-primary ring-offset-2
```

### States
```
Idle:     Normal styling, cursor pointer
Hover:    Background shift, shadow increase
Active:   Scale 0.98, shadow inverted
Focus:    Ring visible (always, keyboard accessible)
Disabled: Muted colors, no pointer
Loading:  Spinner inside button, disabled clicks
```

### Button Group (Related Actions)
```
├─ Buttons arranged horizontally
├─ Gap between: 8px
├─ First & last: normal radius (rounded-lg)
├─ Middle buttons: radius 0
└─ Border merges visually (no double borders)
```

---

## 3. CARD COMPONENT SPECIFICATIONS

### Basic Card Anatomy
```
┌─ Card Container ─────────────────┐
│ ┌─ Header (optional) ──────────┐ │
│ │ Avatar | Name | Menu         │ │
│ └──────────────────────────────┘ │
│ ┌─ Media Container (optional) ──┐ │
│ │ Image (16:9 or 4:3)           │ │
│ └──────────────────────────────┘ │
│ ┌─ Content ────────────────────┐ │
│ │ Title (h3 or h4)             │ │
│ │ Description (body-sm)        │ │
│ │ Stats/Metadata               │ │
│ └──────────────────────────────┘ │
│ ┌─ Footer (optional) ──────────┐ │
│ │ Actions | Timestamp          │ │
│ └──────────────────────────────┘ │
└─────────────────────────────────┘
```

### Styling
```
Background: --card
Border: 1px solid --border
Border Radius: 16px (rounded-2xl)
Padding: 16px (p-4)
Box Shadow: none (elevated on hover)
Hover: bg-card-hover, shadow-sm
Transition: 200ms ease-out
```

### Card Header Anatomy (When Included)
```
[Avatar 32px] [Name h4 + Meta] [Menu Button]
  32px          flex-1           24px icon
```

### Media Container (When Included)
```
Aspect Ratio: 16:9 (prefer) or 4:3
Cover object: image fills container
Border Radius: 12px (rounded-lg)
Overflow: hidden
Height: 180–240px (context-dependent)
```

### Content Section
```
Title: h3 or h4, --foreground, line-clamp-2
Description: body-sm, --foreground-muted, line-clamp-3
Stats: caption or label, color-coded (success for positive)
Spacing: 12px between title/description, 16px before footer
```

### Footer Section (When Included)
```
Layout: flex, justify-between
Left: Engagement stats (comments, likes count)
Right: Timestamp (caption, --foreground-muted)
Spacing: 12px top margin
```

---

## 4. FEED CARD (Social) SPECIFICATIONS

### Three-Tier Rendering Strategy

**Tier 1: Thumbnail/List View (Feed Scroll)**
```
Display:
├─ Avatar (28px) + Name (body-sm, bold) + Timestamp (caption)
├─ Content preview (body-sm, 1 line max, clipped)
└─ Engagement stats (caption: likes, comments, shares)

Height: ~72px
Padding: 12px
Border: 1px --border
On Click: expand to Tier 2 or full modal
```

**Tier 2: Expanded Card (On Hover/Focus)**
```
Display:
├─ Full header (avatar + name + verified badge + menu)
├─ Full media (16:9, 200px height)
├─ Full content (h3 title + body text)
├─ Creator bio snippet (body-sm, 1 line, hover state)
└─ Interaction buttons (Like, Comment, Share, Save)

Height: ~380px
Padding: 16px
Border: 1px --border
Hover Shadow: shadow-md
Interaction Zone: all buttons visible
```

**Tier 3: Full Detail (Modal/Page)**
```
Display:
├─ Full-screen or modal overlay
├─ Content: all metadata visible
├─ Comments thread: in-line or expandable
├─ Engagement breakdown: granular stats
└─ Share/Save/Report actions: full menu

Media: larger, full-width (or modal-width)
Comments: full depth visible, no truncation
```

### Feed Card Hover/Interactive States
```
Idle:
├─ Card shows Tier 1 (minimal)
├─ Border: --border
└─ Background: --card

Hover:
├─ Card expands to Tier 2 (if desktop)
├─ Shadow: shadow-sm
└─ Background: --card-hover

Click:
└─ Navigate to Tier 3 (full detail)
```

---

## 5. CREATOR PROFILE CARD SPECIFICATIONS

### Profile Header Section
```
┌─ Cover Image ─────────────────────────┐
│ 16:9 aspect ratio, 320px height       │
│ Gradient overlay (top & bottom)       │
│ [Edit Cover Button] - if own profile  │
└───────────────────────────────────────┘

[Avatar -32px overlap]
  48px circle, white border (2px)
  
[Name h2] [Tier Badge] [Verification ✓]
[Bio text - 2 lines max] [Links row]

[Stats Row]
├─ Posts (count)
├─ Followers (count, with trend arrow if growing)
└─ Earnings (if creator)
```

### Creator Stats Grid
```
Stat Item (3 columns on desktop, 2 on mobile):
├─ Label (micro, uppercase, --muted)
├─ Value (h3, --foreground, bold)
└─ Trend (arrow + %, --success or --warning)

Spacing: 16px between items
Background: subtle --card tint (optional)
Padding: 12px per item
Border Radius: 12px (rounded-lg)
```

### Creator Action Buttons (Profile Header)
```
Primary Actions (if viewing other creator):
├─ Follow Button (primary)
├─ Message Button (secondary)
└─ Share Button (ghost)

Primary Actions (if viewing own):
├─ Edit Profile Button (secondary)
├─ Settings Button (ghost icon)
└─ Share Profile Button (ghost)

Layout: flex, gap-2, sticky (if scrolling)
Position: below profile header (mobile) or fixed (desktop)
```

### Trust/Reputation Score (Creator)
```
Circular Progress:
├─ Diameter: 64px
├─ Background: --border
├─ Fill: gradient (--error → --warning → --success)
├─ Text: score number (center, h4, bold)
└─ Label: "TRUST SCORE" (micro, below)

Hover Tooltip:
├─ Breakdown of score components
├─ "Accuracy: 99%, Response: <2h, Upvotes: 4.8k"
└─ Position: above on desktop, below on mobile
```

---

## 6. MESSAGING UI SPECIFICATIONS

### Message Bubble

**Received Message:**
```
┌─────────────────────────────────┐
│ [Avatar 28px] [Name] [Timestamp]│  Caption row
│               [Message Body]    │  Body (max 70% width)
│               [Reactions] [Edit]│  Optional footer
└─────────────────────────────────┘
```

**Sent Message:**
```
                     ┌──────────────────────┐
                     │ [Message Body]       │  Right-aligned
                     │ [Timestamp] [Read✓✓] │  Delivery status
                     └──────────────────────┘
```

### Styling
```
Received Bubble:
├─ Background: --card
├─ Border: 1px --border
├─ Text: --foreground
├─ Border Radius: 16px (rounded-2xl)
├─ Padding: 12px
└─ Max Width: 70% of container

Sent Bubble:
├─ Background: --primary
├─ Border: none
├─ Text: white
├─ Border Radius: 16px (rounded-2xl, rounded-tr-none for tail)
├─ Padding: 12px
└─ Max Width: 70% of container
```

### Message Timestamps
```
Format: "10:42 AM" or "A few seconds ago" (relative)
Size: caption (10px), --foreground-muted (70% opacity)
Position: below message bubble or right-aligned (sent)
Display: on hover (mobile) or always visible (desktop)
```

### Message Reactions
```
Reaction Item:
├─ Emoji (20px)
├─ Count (caption, --foreground-muted)
├─ Layout: inline, gap-1
└─ Hover: bg-muted/30, slight scale

Reaction Picker:
├─ Appears on message hover (emoji menu icon)
├─ 6–8 emoji reactions default
├─ Scrollable: emoji grid
└─ Position: above message bubble
```

---

## 7. NOTIFICATION & ALERT SPECIFICATIONS

### Notification Toast (Transient)

**Anatomy:**
```
[Icon 24px] [Title + Body] [Action Button] [Close]
  color      flex-1          (optional)      icon
  coded
```

**Styling:**
```
Background: --card (or semantic color with 10% opacity)
Border: 1px --border (or semantic color with 30% opacity)
Border Radius: 12px (rounded-lg)
Padding: 12px 16px (py-3 px-4)
Box Shadow: shadow-md
Position: top-right (desktop) or bottom (mobile)
Width: max-content (desktop), full-width – 16px (mobile)
```

**Animation:**
```
Enter: slide-in from right + fade (250ms, ease-out)
Hold: 4–6 seconds
Exit: fade + slide-out (200ms, ease-in)
Dismiss: on click or timeout, instant removal
```

### Notification Badge (On Icons/Buttons)

**Anatomy:**
```
Circular count badge (8px–16px diameter)
Background: --error or --primary
Text: white, bold, caption (10px)
Position: top-right of icon
```

**Animation:**
```
On New Notification:
├─ Scale: 0 → 1.3 → 1 (300ms, spring curve)
├─ Color pulse: primary → darker → primary (200ms)
└─ Repeat until dismissed

Animation Timing:
├─ Starts immediately on trigger
├─ Spring easing: cubic-bezier(0.34, 1.56, 0.64, 1)
└─ No repeat (single notification cycle)
```

### Alert Component (Persistent)

**Anatomy:**
```
┌─ Alert Container ────────────────────────┐
│ [Icon] [Title] [Description] [Action]   │
│        [bold]  [regular]      [button]  │
└──────────────────────────────────────────┘
```

**Variants:**
```
Success Alert:
├─ Icon: checkmark (--success)
├─ Background: --success with 10% opacity
├─ Border: --success with 30% opacity

Error Alert:
├─ Icon: alert (--error)
├─ Background: --error with 10% opacity
├─ Border: --error with 30% opacity

Warning Alert:
├─ Icon: warning (--warning)
├─ Background: --warning with 10% opacity
├─ Border: --warning with 30% opacity

Info Alert:
├─ Icon: info (--info)
├─ Background: --info with 10% opacity
├─ Border: --info with 30% opacity
```

**Positioning:**
```
Inline: within content flow (forms, pages)
Sticky: top of container (below header)
Modal: centered, blocking (critical alerts)
Toast: fixed position, stacking
```

---

## 8. FORM COMPONENT SPECIFICATIONS

### Text Input
```
Anatomy:
├─ Label (above input, body-sm, --foreground, bold)
├─ Input field (14px text, 40px height)
├─ Placeholder (gray, --muted)
└─ Error message (below, caption, --error)

Styling:
├─ Background: --card (slightly darker)
├─ Border: 1px --border
├─ Padding: 10px 12px (py-2.5 px-3)
├─ Border Radius: 12px (rounded-lg)
├─ Focus: ring-2 ring-primary, ring-offset-2
└─ Disabled: bg-muted, text-muted, no cursor

States:
├─ Idle: --border
├─ Focus: --primary ring
├─ Hover: --border-light
├─ Error: --error border + background
└─ Disabled: --muted
```

### Checkbox & Radio
```
Checkbox:
├─ Size: 20px × 20px
├─ Border: 1px --border
├─ Checked: --primary background
├─ Checkmark: white, animated
├─ Hover: --primary/20 background
└─ Focus: --primary ring-2

Radio:
├─ Size: 20px × 20px
├─ Border: 2px --border
├─ Selected: inner circle --primary
├─ Hover: --primary/20 background
└─ Focus: --primary ring-2
```

### Select Dropdown
```
Anatomy:
├─ Select button (shows selected value)
├─ Dropdown icon (right, --muted-foreground)
├─ Trigger: click or keyboard
└─ Dropdown panel (list of options)

Styling:
├─ Button: 40px height, 12px padding, --border
├─ Dropdown: max-height 200px, scrollable
├─ Options: 40px height, padding 10px 12px
├─ Hover: --card-hover background
├─ Selected: --primary/10 background, bold text
└─ Disabled: --muted styling

Animation:
├─ Open: fade-in + scale-y (200ms, ease-out)
├─ Close: fade-out + scale-y (150ms, ease-in)
└─ Options: staggered fade (optional)
```

---

## 9. AVATAR SPECIFICATIONS

### Avatar Styles

**Profile Avatar (User)**
```
Size: 48px × 48px (can be 32px, 64px, etc.)
Shape: circle
Border: none (profile), 2px white (in cards)
Background: --primary/20 (fallback)
Letter: 1 letter, h4, bold, --primary
Image: full cover (object-cover)
Shadow: shadow-md (optional, on large avatars)
```

**Small Avatar (Inline)**
```
Size: 28px × 28px
Used in: comments, replies, quick mentions
Styling: same as profile, no shadow
```

**Group Avatar (Multiple Users)**
```
Stacked avatars, overlapping (-8px offset)
Container: 32px height
Individual: 24px circle
Maximum visible: 3 avatars (4th shows "+2 more")
```

**Creator Tier Avatar (Special)**
```
Base: 48px circle (or 32px)
Border: 3px solid (tier color)
├─ Bronze: 3px --tier-bronze
├─ Silver: 3px --tier-silver
├─ Gold: 3px --tier-gold
└─ Platinum: 3px --tier-platinum
Glow (optional): shadow with tier color
```

---

## 10. BADGE SPECIFICATIONS

### Badge Variants

**Solid Badge**
```
Background: semantic color (primary, success, etc.)
Text: white, bold, caption (11px)
Padding: 4px 12px (px-3 py-1)
Border Radius: 6px (rounded-md)
No border, no shadow
```

**Outline Badge**
```
Background: transparent
Border: 1px semantic color
Text: semantic color, bold, caption
Padding: 4px 12px
Border Radius: 6px
```

**Subtle Badge**
```
Background: semantic color with 10% opacity
Text: semantic color, bold, caption
Border: none
Padding: 4px 12px
Border Radius: 6px
```

### Badge Examples

**Verification Badge**
```
Icon + Text: "✓ Verified"
Color: --primary or --success
Inline with name (always)
Size: 16px icon + 12px text
```

**Creator Tier Badge**
```
Icon + Text: "Pro" or "Gold Creator"
Color: tier color
Position: below name or in profile header
Size: 12px text, 16px icon
```

**Live Badge**
```
Icon (dot) + Text: "LIVE"
Color: --live-pulse (animated)
Pulsing animation (opacity, scale)
Size: 12px text, 8px dot
```

---

## 11. LOADING & EMPTY STATES

### Skeleton Loading Pattern

**Anatomy:**
```
[Skeleton block] (matches shape of content)
├─ Background: --muted
├─ Animation: shimmer (left-to-right)
├─ Duration: 1.5s ease-in-out, looped
└─ Opacity: 0.6 (not distracting)
```

**Examples:**
```
Text skeleton: 240px × 16px rectangle
Image skeleton: 320px × 180px rectangle
Avatar skeleton: 48px circle
Card skeleton: full card outline with placeholders
```

### Empty State

**Anatomy:**
```
┌──────────────────────┐
│  [Icon 64px, gray]   │
│  [Title h3]          │
│  [Subtitle body-sm]  │
│  [CTA Button]        │
└──────────────────────┘
```

**Styling:**
```
Icon: --muted, 50% opacity
Title: --foreground
Subtitle: --foreground-muted
Button: primary or secondary
Alignment: center
Padding: 32–48px top/bottom
```

---

## 12. COMPONENT EXPORT STANDARD

### File Structure
```
components/
├─ ui/                    (shadcn/ui base components)
│  ├─ button.jsx
│  ├─ card.jsx
│  └─ ...
├─ feed/
│  ├─ FeedCard.jsx        (custom, reusable)
│  ├─ PostCard.jsx
│  └─ FeedCardSkeleton.jsx
├─ creator/
│  ├─ CreatorProfile.jsx
│  ├─ CreatorBadge.jsx
│  └─ TierBadge.jsx
├─ messaging/
│  ├─ MessageBubble.jsx
│  ├─ MessageInput.jsx
│  └─ TypingIndicator.jsx
└─ common/
   ├─ Avatar.jsx
   ├─ LoadingSpinner.jsx
   └─ EmptyState.jsx
```

### Export Pattern
```javascript
// components/feed/FeedCard.jsx
export default function FeedCard({ 
  author, 
  content, 
  media, 
  stats,
  onLike,
  onComment,
  onShare
}) {
  // implementation
}

// Usage in pages
import FeedCard from '@/components/feed/FeedCard';
```

---

**Component Design Principle:** Every component is reusable, accessible, and adheres to the StudentOS dark-mode-first design system. Components are built atomically and compose into complex, sophisticated interfaces.
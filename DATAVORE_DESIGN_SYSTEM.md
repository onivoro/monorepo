# DataVore UI Modernization - Design System Reference

## Design Tokens

### Color Palette (Dark Theme - Postico2 Inspired)

```
Backgrounds:
  Primary:     #1a1a1a  (Main background)
  Secondary:   #242424  (Surfaces/cards)
  Tertiary:    #2d2d2d  (Hover/selected)

Text:
  Primary:     #e8e8e8  (Primary text on dark)
  Secondary:   #a0a0a0  (Secondary/muted text)
  Tertiary:    #707070  (Disabled/faint)

Borders:
  Default:     #3a3a3a  (Standard borders)
  Light:       #4a4a4a  (Subtle borders)

Accents:
  Primary:     #0ea5e9  (Sky blue - primary actions)
  Secondary:   #8b5cf6  (Purple - secondary)
  Tertiary:    #06b6d4  (Cyan - tertiary)

Status:
  Success:     #10b981  (Operations complete)
  Warning:     #f59e0b  (Caution)
  Error:       #ef4444  (Errors/destructive)
  Info:        #06b6d4  (Information)
```

### Typography

```
Font Stack (Primary):
  -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif

Font Stack (Monospace):
  'Monaco', 'Menlo', 'Ubuntu Mono', monospace

Font Sizes:
  xs:        12px / 0.75rem   (Captions)
  sm:        14px / 0.875rem  (Labels, small text)
  base:      16px / 1rem      (Body text)
  lg:        18px / 1.125rem  (Subheadings)
  xl:        20px / 1.25rem   (Section titles)
  2xl:       24px / 1.5rem    (Page titles)

Font Weights:
  normal:    400
  medium:    500
  semibold:  600
  bold:      700
```

### Spacing System (4px base unit)

```
0:       0
1:       4px   (0.25rem)
2:       8px   (0.5rem)
3:       12px  (0.75rem)
4:       16px  (1rem)
6:       24px  (1.5rem)
8:       32px  (2rem)
12:      48px  (3rem)
16:      64px  (4rem)
```

### Border Radius

```
sm:      4px
md:      8px
lg:      12px
xl:      16px
full:    9999px (circles)
```

### Shadows

```
sm:      0 1px 2px rgba(0, 0, 0, 0.05)
md:      0 4px 6px rgba(0, 0, 0, 0.1)
lg:      0 10px 15px rgba(0, 0, 0, 0.15)
xl:      0 20px 25px rgba(0, 0, 0, 0.2)
```

### Transitions

```
fast:    150ms ease-out
base:    300ms ease-out
slow:    500ms ease-out
```

---

## Component Styles

### Buttons

```
Primary Button:
  - Background: #0ea5e9
  - Text: #ffffff
  - Padding: 8px 16px
  - Border Radius: 4px
  - Hover: Background #0d9ecf, slight scale (1.02)
  - Active: Background #0b8bb5
  - Disabled: Opacity 0.5

Secondary Button:
  - Background: #2d2d2d
  - Border: 1px solid #3a3a3a
  - Text: #e8e8e8
  - Hover: Background #3a3a3a

Destructive Button:
  - Background: #ef4444
  - Text: #ffffff
  - Hover: Background #dc2626
```

### Input Fields

```
Text Input / Textarea:
  - Background: #242424
  - Border: 1px solid #3a3a3a
  - Text: #e8e8e8
  - Placeholder: #707070
  - Focus: Border #0ea5e9, shadow 0 0 0 3px rgba(14, 165, 233, 0.1)
  - Padding: 8px 12px
  - Border Radius: 4px
```

### Cards / Surfaces

```
Card:
  - Background: #242424
  - Border: 1px solid #3a3a3a
  - Border Radius: 8px
  - Padding: 16px
  - Shadow: 0 4px 6px rgba(0, 0, 0, 0.1)
```

### Tables

```
Header Row:
  - Background: #1a1a1a
  - Border Bottom: 1px solid #3a3a3a
  - Font Weight: 600
  - Text: #e8e8e8

Data Rows:
  - Background: #242424
  - Hover: Background #2d2d2d, left border 3px #0ea5e9
  - Border Bottom: 1px solid #3a3a3a
  - Text: #e8e8e8

Alternate Row:
  - Background: #1f1f1f
```

### Badges

```
Type Badge (e.g., VARCHAR, INT):
  - Background: #2d2d2d
  - Border: 1px solid #3a3a3a
  - Text: #a0a0a0
  - Font: Monospace, 12px
  - Padding: 4px 8px
  - Border Radius: 4px

Status Badge:
  - Success: #10b981 / #0a5d3e background
  - Warning: #f59e0b / #5a3a0a background
  - Error: #ef4444 / #5a1a1a background
```

### Tabs

```
Tab Button (Inactive):
  - Color: #a0a0a0
  - Background: transparent
  - Border Bottom: 2px solid transparent
  - Padding: 12px 16px

Tab Button (Active):
  - Color: #0ea5e9
  - Border Bottom: 2px solid #0ea5e9
  - Font Weight: 600
```

### Status Indicators

```
Connection Status Dot:
  - Connected: #10b981
  - Disconnected: #ef4444
  - Connecting: #f59e0b (blinking)
  - Size: 12px diameter
  - Animation: Pulse on connecting
```

---

## Layout Specifications

### Main Layout
```
┌─────────────────────────────────────┐
│  Header (Connection Info)           │  64px height
├──────────┬──────────────────────────┤
│          │                          │
│ Sidebar  │   Main Content           │  flex 1
│ 300px    │                          │
│          │                          │
└──────────┴──────────────────────────┘

Sidebar: Fixed width 300px, scrollable
  - Connection indicator (12px dot)
  - Connection name
  - Search bar (top)
  - Table list
  - Collapsible sections

Header: Full width
  - Connection name + dot (left)
  - Database / Port info (subtext)
  - Table stats (right)
  - Settings menu (far right)

Main Content: Flex grow
  - Query editor (resizable)
  - Results area (flex grow)
```

### Responsive Breakpoints

```
Mobile (< 768px):
  - Sidebar becomes hamburger menu
  - Single column layout
  - Query editor full width

Tablet (768px - 1024px):
  - Sidebar 250px
  - Query editor: 40% height
  - Results: 60% height

Desktop (> 1024px):
  - Sidebar 300px
  - Query editor: 35% height
  - Results: 65% height
```

---

## Animation Specifications

### Transitions

```
Hover Effects: 150ms ease-out
  - Button color shift
  - Opacity changes

Tab Switches: 200ms ease-out
  - Content fade in/out

Sidebar Animation: 300ms ease-out
  - Open/close collapse
  - Table list slide

Loading: Continuous
  - Spinner rotation (2s per rotation)
  - Pulse effect on indicators
```

### Micro-interactions

```
Button Hover:
  - Color shift (ease-out 150ms)
  - Scale 1.02 on hover
  - Scale 0.98 on click

Loading Spinner:
  - Rotate 360° in 2s (linear)
  - Repeat infinite

Table Row Hover:
  - Background fade (ease-out 150ms)
  - Left border slide in (3px #0ea5e9)
  - Cursor pointer

Toast Notification:
  - Slide in from top (300ms ease-out)
  - Auto-dismiss after 5s (fade out 200ms)
```

---

## Icon System

### Icons Used (Emoji/Unicode or SVG)

```
Tables:          📋 or 🗂️
Views:           👁️ or 🔍
Column:          🏷️ or ⊟
Primary Key:     🔑 or ★
Foreign Key:     🔗 or →
Index:           ⚡ or 📑
Search:          🔍 or 🔎
Settings:        ⚙️ or 🔧
Execute:         ▶️ or ⚡
Add:             ➕ or +
Delete:          🗑️ or ✕
Export:          ⬇️ or 💾
Copy:            📋 or ⧉
Status Online:   🟢 (green circle)
Status Offline:  🔴 (red circle)
Warning:         ⚠️ or ⬤ (orange)
Error:           ❌ or ⊘
Success:         ✓ or ✔️
Menu:            ⋮ or ☰ (hamburger)
Loading:         ⟳ (rotate animation)
```

---

## Code Examples

### CSS Variables Implementation

```css
:root {
  /* Colors */
  --color-bg-primary: #1a1a1a;
  --color-bg-secondary: #242424;
  --color-bg-tertiary: #2d2d2d;
  --color-border: #3a3a3a;
  --color-text-primary: #e8e8e8;
  --color-text-secondary: #a0a0a0;
  --color-accent-primary: #0ea5e9;
  --color-accent-secondary: #8b5cf6;
  --color-status-success: #10b981;
  --color-status-warning: #f59e0b;
  --color-status-error: #ef4444;

  /* Typography */
  --font-primary: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  --size-sm: 0.875rem;
  --size-base: 1rem;
  --size-lg: 1.125rem;
  --size-xl: 1.25rem;
  --size-2xl: 1.5rem;

  /* Spacing */
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;

  /* Border & Shadow */
  --radius-md: 8px;
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);

  /* Transitions */
  --transition-fast: all 150ms ease-out;
  --transition-base: all 300ms ease-out;
}

body {
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-family: var(--font-primary);
  font-size: var(--size-base);
}

.btn {
  background-color: var(--color-accent-primary);
  color: white;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  transition: var(--transition-fast);
  cursor: pointer;
}

.btn:hover {
  background-color: #0d9ecf;
  transform: scale(1.02);
}
```

---

## Migration Checklist

### Phase 1: Design System (Week 1)
- [ ] Add CSS variables to app.controller.ts
- [ ] Update all color values
- [ ] Update typography
- [ ] Update spacing
- [ ] Verify contrast ratios for accessibility

### Phase 2: Layout (Week 2)
- [ ] Update sidebar styling
- [ ] Update header layout
- [ ] Add connection indicator
- [ ] Update query editor styling
- [ ] Update results area styling

### Phase 3: Components (Week 3)
- [ ] Style buttons and inputs
- [ ] Enhance table rendering
- [ ] Add type badges
- [ ] Improve tabs

### Phase 4: Polish (Week 4)
- [ ] Add transitions and animations
- [ ] Add hover states
- [ ] Add loading states
- [ ] Test across browsers
- [ ] Gather feedback

---

## Browser Support

```
Target Browsers:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- No IE 11 support (uses CSS Grid, variables, etc.)

CSS Features Used:
- CSS Custom Properties (variables)
- CSS Grid (optional, for layout)
- Flexbox (primary layout)
- CSS Animations
- CSS Gradients (optional, for accents)
- CSS Transitions
```

---

## Accessibility Notes

```
Color Contrast:
- Primary text on primary background: #e8e8e8 on #1a1a1a ✓ (16.5:1)
- Primary text on secondary background: #e8e8e8 on #242424 ✓ (16:1)
- Secondary text: #a0a0a0 on #1a1a1a ✓ (5.2:1)
- Accent on background: #0ea5e9 on #1a1a1a ✓ (6.3:1)

Keyboard Navigation:
- All buttons focusable with tab
- Focus ring: 3px solid #0ea5e9
- No focus traps
- Logical tab order

ARIA Labels:
- Add aria-label to icon buttons
- Use aria-selected for tabs
- Use aria-disabled for disabled elements
- Add aria-live for status updates
```

---

## Performance Targets

```
Metrics:
- First Contentful Paint: < 1.5s
- Largest Contentful Paint: < 2.5s
- Cumulative Layout Shift: < 0.1
- Time to Interactive: < 3s

Optimization:
- CSS variables (no pre-compilation needed)
- Inline critical CSS
- Defer non-critical animations
- Lazy load code editor library
- Optimize SVG/icon usage
```

---

## Resources & References

### Similar Design Systems:
- **Postico2**: postico.app (Inspiration)
- **Linear**: linear.app (Modern SaaS design)
- **Stripe**: stripe.design (Professional design system)
- **GitHub**: primer.style (Open source design system)

### Tools Suggested:
- **CodeMirror**: codemirror.net (Code editor)
- **Alpine.js**: alpinejs.dev (Already used)
- **Pico CSS**: picocss.com (Lightweight CSS framework - alternative)


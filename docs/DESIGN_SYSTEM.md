# Design System - Gojiberry Light Mode

> Cohesive light mode design system with coral primary colors and glassmorphism effects

## 🎨 Overview

SearchCommerce uses a custom **Gojiberry-inspired light mode** design system with:
- Light beige backgrounds (#faf8f5)
- Coral/orange primary colors (#FF6B4A, #FF5733)
- Glassmorphism effects for floating elements
- Consistent design tokens across all components

**Last updated:** 2025-12-30

---

## 🎯 Design Principles

1. **Light & Airy**: Beige backgrounds create a warm, professional atmosphere
2. **Coral Accents**: Primary color (#FF6B4A) for CTAs and interactive elements
3. **Glassmorphism**: Semi-transparent surfaces with backdrop blur for depth
4. **Consistency**: All components use centralized design tokens
5. **Accessibility**: High contrast ratios and clear visual hierarchy

---

## 🌈 Color Palette

### Primary Colors

| Color | Value | Usage |
|-------|-------|-------|
| **Primary 500** | `#FF6B4A` | Main CTAs, buttons, links |
| **Primary 600** | `#FF5733` | Hover states, emphasis |
| **Primary 100** | `rgba(255, 107, 74, 0.1)` | Light backgrounds |

### Surface Colors

| Color | Variable | Hex | Usage |
|-------|----------|-----|-------|
| **Surface 50** | `--surface-50` | `#fefefe` | Pure white (cards) |
| **Surface 100** | `--surface-100` | `#faf8f5` | Main background |
| **Surface 200** | `--surface-200` | `#f5f3f0` | Subtle sections |
| **Surface 300** | `--surface-300` | `#f0ede8` | Hover states |
| **Surface 400** | `--surface-400` | `#e8e4df` | Borders |
| **Surface 500** | `--surface-500` | `#d4d0ca` | Dividers |
| **Surface 600** | `--surface-600` | `#b8b4ae` | Disabled states |

### Text Colors

| Color | Variable | Usage |
|-------|----------|-------|
| **Text Primary** | `--text-primary` | `#1f2937` | Main text |
| **Text Secondary** | `--text-secondary` | `#374151` | Secondary text |
| **Text Tertiary** | `--text-tertiary` | `#6b7280` | Muted text |
| **Text Muted** | `--text-muted` | `#9ca3af` | Placeholders |

### Glassmorphism

| Variable | Value | Usage |
|----------|-------|-------|
| `--glass-bg` | `rgba(255, 255, 255, 0.7)` | Standard glass |
| `--glass-bg-elevated` | `rgba(255, 255, 255, 0.85)` | Elevated surfaces |
| `--glass-border` | `rgba(255, 255, 255, 0.5)` | Glass borders |

---

## 🧩 Component Patterns

### Glassmorphism Pattern

Used for floating elements (CartWidget, modals, tooltips):

```jsx
className="bg-white/70 backdrop-blur-xl border border-white/50 shadow-xl"
```

### Card Pattern

Standard card with hover effects:

```jsx
<Card
  variant="default"
  hover
  glow
  padding="md"
>
  {children}
</Card>
```

### Button Pattern

Primary action button:

```jsx
<Button
  variant="primary"
  size="lg"
  glow
  icon={<Icon size={18} />}
>
  Action
</Button>
```

### Modal Pattern

Standard modal with light backdrop:

```jsx
<Modal
  isOpen={isOpen}
  onClose={onClose}
  size="lg"
>
  <ModalHeader>
    <ModalTitle>Title</ModalTitle>
  </ModalHeader>
  <ModalBody>{content}</ModalBody>
  <ModalFooter>{actions}</ModalFooter>
</Modal>
```

---

## 📐 Layout Structure

### Application Layout

```
┌─────────────────────────────────────┐
│ Layout (flex h-screen w-screen)    │
│ ┌──────────┐ ┌──────────────────┐ │
│ │ Sidebar  │ │ Main (Map)       │ │
│ │ 420px    │ │ flex-1           │ │
│ │          │ │                  │ │
│ │ Search   │ │ Leaflet Map      │ │
│ │ Results  │ │                  │ │
│ │          │ │                  │ │
│ └──────────┘ └──────────────────┘ │
└─────────────────────────────────────┘
```

**Key classes:**
- Container: `flex h-screen w-screen overflow-hidden bg-surface-100`
- Sidebar: `w-[420px] h-full bg-white/70 backdrop-blur-xl`
- Main: `flex-1 h-full w-full overflow-hidden`

---

## 🎭 Component Library

### Core UI Components

Located in `src/components/ui/`:

| Component | Description | Key Props |
|-----------|-------------|-----------|
| **Button** | Primary, secondary, ghost variants | `variant`, `size`, `glow`, `icon` |
| **Card** | Container with hover/glow effects | `hover`, `glow`, `padding` |
| **Badge** | Status indicators | `variant` (cyan, yellow, violet, success, etc.) |
| **Input** | Form input with icons | `icon`, `iconRight`, `error`, `success` |
| **Textarea** | Multi-line text input | `rows`, `error`, `hint` |
| **Modal** | Overlay dialog | `size`, `closeOnBackdrop`, `showCloseButton` |
| **FormInput** | Structured form field with icon | `icon`, `prefix`, `helpText` |
| **FormTextarea** | Structured textarea | `icon`, `helpText` |
| **RadioCardGroup** | Visual radio buttons | `options`, `columns` |

### Specialized Components

| Component | Description |
|-----------|-------------|
| **Layout** | Main app layout (sidebar + map) |
| **CartWidget** | Floating cart with glassmorphism |
| **SearchPanel** | Left sidebar with search and results |
| **Map** | Leaflet map with custom markers |
| **ProfessionalAnalysisModal** | Dual-panel analysis interface |
| **NoteModal** | Note editing dialog |
| **DocumentUploadModal** | PDF upload interface |

---

## 🗺️ Map Styling (Leaflet)

### Background

```css
.leaflet-container {
  background: var(--surface-100) !important; /* Beige #faf8f5 */
}
```

### Controls

```css
.leaflet-control-zoom {
  background: var(--glass-bg-elevated);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-default);
  box-shadow: var(--shadow-md);
}

.leaflet-control-zoom a:hover {
  background: var(--surface-50);
  color: var(--primary-500); /* Coral */
}
```

### Popups

```css
.leaflet-popup-content-wrapper {
  background: var(--surface-50); /* White */
  border: 2px solid var(--border-default);
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-xl);
}
```

---

## 🔧 Design Tokens

All design tokens are defined in:
- **CSS Variables**: `src/styles/design-tokens.css`
- **Tailwind Config**: `tailwind.config.js`

### CSS Custom Properties

```css
:root {
  /* Primary Colors */
  --primary-500: #FF6B4A;
  --primary-600: #FF5733;

  /* Surfaces */
  --surface-100: #faf8f5;
  --surface-200: #f5f3f0;

  /* Glassmorphism */
  --glass-bg: rgba(255, 255, 255, 0.7);
  --glass-bg-elevated: rgba(255, 255, 255, 0.85);

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}
```

### Tailwind Extensions

```javascript
theme: {
  extend: {
    colors: {
      primary: {
        500: '#FF6B4A',
        600: '#FF5733',
      },
      surface: {
        50: '#fefefe',
        100: '#faf8f5',
        200: '#f5f3f0',
        // ...
      }
    }
  }
}
```

---

## 🚫 Removed Dark Mode

**Migration (2025-12-30):**
- ❌ Removed `--surface-700` through `--surface-950`
- ❌ Removed all dark mode shadows and gradients
- ❌ Replaced cyan accent (`#00d4ff`) with coral (`#FF6B4A`)
- ❌ Replaced blue buttons (`#3b82f6`) with coral
- ❌ Replaced black backdrops with light semi-transparent

---

## 📱 Responsive Behavior

### Sidebar
- **Desktop**: Fixed 420px width
- **Mobile**: ~~Full width~~ (removed to keep map visible)

### Map
- Always visible alongside sidebar
- Takes remaining screen space (`flex-1`)

### Modals
- Responsive width: `w-[95vw] max-w-[...]`
- Always centered with backdrop blur

---

## ✅ Migration Checklist

When creating new components:

- [ ] Use `bg-surface-100` for main backgrounds
- [ ] Use `bg-white` or `bg-surface-50` for cards
- [ ] Use `bg-primary-500` for primary buttons
- [ ] Use `text-primary` for main text colors
- [ ] Apply glassmorphism pattern for floating elements
- [ ] Use design tokens instead of hardcoded colors
- [ ] Test hover states use `hover:bg-primary-600`
- [ ] Ensure proper border colors (`border-surface-300`)

---

## 🔗 Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Technical architecture
- [DEVELOPMENT.md](./DEVELOPMENT.md) - Development guide
- [Gojiberry.ai](https://gojiberry.ai/) - Design inspiration

---

**Design System Version:** 1.0.0
**Last Updated:** 2025-12-30
**Maintained By:** Claude Code

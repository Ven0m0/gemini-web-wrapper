# Design System - OpenCode Inspired

## Overview

This design system is inspired by OpenCode's clean, developer-focused interface with emphasis on:
- Dark-first design
- Code-centric aesthetics
- Minimal, functional UI
- High contrast and accessibility

## Color Palette

### Dark Theme (Default)
- **Background**: Pure black (`#000000`) with elevated surfaces
- **Text**: High contrast white/gray tones
- **Primary**: Blue (`#3b82f6`) for interactive elements
- **Accent**: Purple (`#8b5cf6`) for highlights
- **Success**: Green (`#22c55e`)
- **Error**: Red (`#ef4444`)
- **Warning**: Amber (`#f59e0b`)

### Light Theme
- Available via theme switcher
- Inverted color scheme maintaining contrast ratios

## Typography

### Fonts
- **Sans**: Geist, SF Pro Display, system fonts
- **Mono**: Geist Mono, SF Mono, Cascadia Code for code

### Hierarchy
- Terminal/Editor: 14px monospace
- UI Elements: 13-14px sans-serif
- Headers: 20-24px sans-serif, semi-bold

## Components

### Terminal
- Full-screen dark background
- Monospace font for all content
- Prominent command prompt with primary color
- Smooth animations for new lines
- Blinking cursor indicator

### Editor
- Status bar with branch/file info
- Mode switcher (Original/Modified/Diff)
- CodeMirror integration with One Dark theme
- Inline diff visualization

### Buttons
- Primary: Filled with primary color
- Secondary: Surface background with border
- Ghost: Transparent with hover state
- Consistent 6-8px border radius
- Smooth transitions (200ms)

### Input Fields
- Surface background with subtle border
- Focus state with primary color ring
- Monospace font for code-related inputs
- Comfortable padding (10-14px)

## Spacing Scale

- XS: 0.25rem (4px)
- SM: 0.5rem (8px)
- MD: 0.75rem (12px)
- LG: 1rem (16px)
- XL: 1.5rem (24px)
- 2XL: 2rem (32px)

## Border Radius

- Small: 6px (buttons, inputs)
- Medium: 8px (cards, modals)
- Large: 12px (overlays)

## Shadows

Subtle shadows on dark backgrounds:
- Small: For hover states
- Medium: For dropdowns/popovers
- Large: For modals/overlays

## Animations

- Fast: 150ms (hover states)
- Normal: 200ms (component transitions)
- Slow: 300ms (page transitions)
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)`

## Accessibility

- WCAG 2.1 AA compliant contrast ratios
- Focus visible outlines (2px primary color)
- Keyboard navigation support
- Reduced motion support via media queries
- Semantic HTML structure
- ARIA labels where appropriate

## Responsive Design

### Breakpoints
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

### Mobile Optimizations
- Touch-friendly hit areas (44px minimum)
- Larger font sizes (prevent zoom)
- Simplified navigation
- Optimized spacing

## Implementation Notes

1. All colors use CSS custom properties for easy theming
2. Components are mobile-first responsive
3. Animations respect `prefers-reduced-motion`
4. Dark theme is default on initial load
5. System font stacks for optimal performance

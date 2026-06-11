## 2025-06-11 - Add ARIA label and title to detail-close button
**Learning:** Found that the "✕" icon-only button for closing the detail panel lacked an `aria-label` for screen readers and a `title` for visual tooltips for mouse users. This breaks WCAG guidelines on icon buttons.
**Action:** Always provide `aria-label` for screen reader accessibility and `title` attribute for visual tooltips for mouse users when using icon-only buttons with text-symbols like "✕".

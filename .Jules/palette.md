## 2026-05-28 - ARIA labels on icon-only buttons with visible text symbols
**Learning:** While WCAG 2.5.3 (Label in Name) usually requires the visible text to be part of the accessible name, including decorative symbols like "✕" in the `aria-label` causes screen readers to read the symbol aloud unnecessarily (e.g., "Close detail panel cross").
**Action:** When adding ARIA labels to buttons that only use symbols (like "✕") for icons, omit the symbol from the `aria-label` and rely on clear descriptive text (e.g., `aria-label="Close detail panel"`).

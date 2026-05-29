## 2024-05-29 - Accessible Icon-Only Buttons
**Learning:** Icon-only buttons using text symbols like "✕" need special care. While visually apparent, screen readers may read the symbol aloud unnecessarily or provide no context.
**Action:** Always provide `aria-label` for screen reader users (without including the symbol in the text) and `title` for visual tooltips for mouse users when working with text-symbol buttons.

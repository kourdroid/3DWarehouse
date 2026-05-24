## 2024-05-15 - Missing ARIA Labels & Focus States
**Learning:** The custom UI components, including the "X" close buttons and generic buttons, lacked both visual focus states (`:focus-visible`) and semantic identification (`aria-label`). This makes keyboard navigation almost impossible.
**Action:** Always verify custom components to ensure they have default ARIA labels when visually identified by icon-only or generic labels, and ensure keyboard navigation creates visible focus states.

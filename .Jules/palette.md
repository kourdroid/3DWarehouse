## 2026-06-09 - [Added Accessibility Labels to Icon-only Button]
**Learning:** For icon-only buttons that use text-symbols (like '✕'), always provide an `aria-label` for screen reader accessibility and a `title` attribute for visual tooltips for mouse users. Exception: do not include the text-symbol itself in the `aria-label`.
**Action:** Always ensure that icon-only interactive elements in the warehouse detail panels have both an aria-label and title for full accessibility coverage.

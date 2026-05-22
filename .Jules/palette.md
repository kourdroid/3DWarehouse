## 2024-05-22 - [Add ARIA labels to icon buttons]
**Learning:** Added ARIA labels to the close button ("✕") and search features to improve screen reader accessibility without changing visual UI. Found that the frontend does not use Node.js and instead uses simple Python static hosting, so typical build steps and linters like pnpm aren't applicable.
**Action:** Always verify if a build step exists before attempting Node commands. Focus solely on DOM updates for frontend UX tasks.

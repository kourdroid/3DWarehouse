// ═══════════════════════════════════════════════════════
//  SMATCH WAREHOUSE — APP ROUTER
//  Handles hash routing between 3D Viewer and 2D Builder
// ═══════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    const viewerContainer = document.getElementById('viewer-container');
    const builderContainer = document.getElementById('builder-container');

    let viewerInitialized = false;
    let builderInitialized = false;

    function handleRoute() {
        const hash = window.location.hash || '#/viewer';

        if (hash === '#/viewer') {
            // Show Viewer, Hide Builder
            viewerContainer.style.display = 'block';
            builderContainer.style.display = 'none';

            if (!viewerInitialized) {
                // Initialize the 3D Viewer (from warehouse.app.js)
                if (typeof init === 'function') {
                    init();
                    viewerInitialized = true;
                }
            }
        } else if (hash === '#/builder') {
            // Show Builder, Hide Viewer
            viewerContainer.style.display = 'none';
            builderContainer.style.display = 'block';

            if (!builderInitialized) {
                // Initialize the 2D Builder (once implemented)
                if (typeof initBuilder === 'function') {
                    initBuilder();
                } else {
                    builderContainer.innerHTML = '<div style="color: white; padding: 20px;">Builder is under construction...</div>';
                }
                builderInitialized = true;
            }
        }
    }

    // Listen for hash changes
    window.addEventListener('hashchange', handleRoute);

    // Initial route handling
    handleRoute();
});

// ═══════════════════════════════════════════════════════
//  SMATCH WAREHOUSE — APP ROUTER
//  Handles hash routing between 3D Viewer and 2D Builder
// ═══════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    const viewerContainer = document.getElementById('viewer-container');
    const builderContainer = document.getElementById('builder-container');
    const importContainer = document.getElementById('import-container');
    let builderModulesPromise = null;
    let importModulesPromise = null;

    let viewerInitialized = false;
    let builderInitialized = false;
    let importInitialized = false;

    function loadBuilderModules() {
        if (builderModulesPromise) {
            return builderModulesPromise;
        }

        const builderScripts = [
            './scripts/builder/builder.commands.js',
            './scripts/builder/builder.api.js',
            './scripts/builder/builder.canvas.js',
            './scripts/builder/builder.panel.js',
        ];

        builderModulesPromise = builderScripts.reduce((chain, src) => {
            return chain.then(() => new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = src;
                script.onload = resolve;
                script.onerror = () => reject(new Error(`Failed to load ${src}`));
                document.body.appendChild(script);
            }));
        }, Promise.resolve());

        return builderModulesPromise;
    }

    function loadImportModules() {
        if (importModulesPromise) {
            return importModulesPromise;
        }

        importModulesPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = './scripts/import.layout.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error('Failed to load ./scripts/import.layout.js'));
            document.body.appendChild(script);
        });

        return importModulesPromise;
    }

    async function handleRoute() {
        const hash = window.location.hash || '#/viewer';

        if (hash === '#/viewer') {
            // Show Viewer, Hide Builder
            viewerContainer.style.display = 'block';
            builderContainer.style.display = 'none';
            importContainer.style.display = 'none';

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
            importContainer.style.display = 'none';

            if (!builderInitialized) {
                try {
                    await loadBuilderModules();
                    if (typeof initBuilder === 'function') {
                        initBuilder();
                    } else {
                        builderContainer.innerHTML = '<div style="color: white; padding: 20px;">Builder is unavailable.</div>';
                    }
                } catch (error) {
                    builderContainer.innerHTML = '<div style="color: white; padding: 20px;">Builder is under construction...</div>';
                    console.error(error);
                }
                builderInitialized = true;
            }
        } else if (hash === '#/import') {
            viewerContainer.style.display = 'none';
            builderContainer.style.display = 'none';
            importContainer.style.display = 'block';

            if (!importInitialized) {
                try {
                    await loadImportModules();
                    if (typeof initImportPage === 'function') {
                        initImportPage();
                    } else {
                        importContainer.innerHTML = '<div style="color: white; padding: 20px;">Import tool is unavailable.</div>';
                    }
                } catch (error) {
                    importContainer.innerHTML = '<div style="color: white; padding: 20px;">Import tool failed to load.</div>';
                    console.error(error);
                }
                importInitialized = true;
            }
        }
    }

    // Listen for hash changes
    window.addEventListener('hashchange', handleRoute);

    // Initial route handling
    handleRoute();
});

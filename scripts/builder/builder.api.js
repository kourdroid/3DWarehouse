// ═══════════════════════════════════════════════════════
//  SMATCH WAREHOUSE BUILDER — API
//  Handles communication with FastAPI backend
// ═══════════════════════════════════════════════════════

const BuilderAPI = {
    baseUrl: 'http://localhost:8000/api/v1',

    async loadLayout(layoutId = 'default') {
        console.log(`[BuilderAPI] Loading layout ${layoutId}`);
        try {
            const response = await fetch(`${this.baseUrl}/layouts/${layoutId}/builder`);
            if (!response.ok) {
                if (response.status === 404) return null;
                throw new Error(`API Error: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('[BuilderAPI] Failed to load layout:', error);
            return null;
        }
    },

    async configureLayout(payload) {
        if (!payload) {
            console.error('[BuilderAPI] Cannot save empty layout payload');
            return null;
        }

        console.log(`[BuilderAPI] Sending layout config`, payload);

        try {
            const response = await fetch(`${this.baseUrl}/layouts/configure`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(`API Error: ${response.status} - ${JSON.stringify(errData)}`);
            }

            const data = await response.json();
            console.log(`[BuilderAPI] Save successful`, data);
            return data;
        } catch (error) {
            console.error('[BuilderAPI] Failed to configure layout:', error);
            alert(`Failed to save layout: ${error.message}`);
            throw error;
        }
    }
};

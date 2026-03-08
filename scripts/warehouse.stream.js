// ═══════════════════════════════════════════════════════
//  SMATCH WAREHOUSE — WEBSOCKET STREAM
//  Listens to the WMS backend for live inventory updates
// ═══════════════════════════════════════════════════════

class WarehouseStream {
    constructor() {
        this.socket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.baseReconnectDelay = 1000;

        // Extract token from URL
        const urlParams = new URLSearchParams(window.location.search);
        this.token = urlParams.get('token') || 'demo-token';
    }

    connect() {
        // Use relative WSS path or fallback to local
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'localhost:8000'
            : window.location.host;

        const wsUrl = `${protocol}//${host}/api/v1/stream?token=${this.token}`;

        console.log(`[Stream] Connecting to ${wsUrl}`);
        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = this.handleOpen.bind(this);
        this.socket.onmessage = this.handleMessage.bind(this);
        this.socket.onclose = this.handleClose.bind(this);
        this.socket.onerror = this.handleError.bind(this);
    }

    handleOpen(event) {
        console.log("[Stream] WebSocket Connection established.");
        this.reconnectAttempts = 0; // Reset
    }

    handleMessage(event) {
        try {
            const payload = JSON.parse(event.data);
            this.demultiplex(payload);
        } catch (e) {
            console.error("[Stream] Failed to parse message:", e);
        }
    }

    demultiplex(payload) {
        switch (payload.event) {
            case "SNAPSHOT":
                console.log("[Stream] Received full snapshot");
                if (window.handleSnapshot) window.handleSnapshot(payload.data);
                break;
            case "UPDATE":
                // console.log("[Stream] Received update delta");
                if (window.handleUpdateDelta) window.handleUpdateDelta(payload.data);
                break;
            case "ALERT":
                console.warn("[Stream] Alert received:", payload.data.message);
                break;
            default:
                console.log("[Stream] Unknown event:", payload.event);
        }
    }

    handleClose(event) {
        console.log(`[Stream] Connection closed. Code: ${event.code}, Reason: ${event.reason}`);
        this.attemptReconnect();
    }

    handleError(error) {
        console.error("[Stream] WebSocket error:", error);
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
            console.log(`[Stream] Reconnecting in ${delay}ms (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            setTimeout(() => this.connect(), delay);
        } else {
            console.error("[Stream] Max reconnect attempts reached. Stream offline.");
            // UI fallback trigger could go here
        }
    }
}

// Global instance
const warehouseStream = new WarehouseStream();

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
        this.hasOpened = false;
        this.portCandidates = [];
        this.currentPortIndex = 0;

        // Extract token from URL
        const urlParams = new URLSearchParams(window.location.search);
        this.token = urlParams.get('token') || 'demo-token';
        this.apiPortOverride = urlParams.get('apiPort');
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const isLocal =
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1';
        const isSplitDev = isLocal && window.location.port === '3000';

        this.hasOpened = false;
        this.currentPortIndex = 0;
        this.portCandidates = [];

        if (this.apiPortOverride) {
            this.portCandidates = [Number(this.apiPortOverride)];
        } else if (isSplitDev) {
            this.portCandidates = [8000, 8001];
        } else {
            this.portCandidates = [null];
        }

        const port = this.portCandidates[this.currentPortIndex];
        const host = this.apiPortOverride || isSplitDev ? `${window.location.hostname}:${port}` : window.location.host;
        const wsUrl = `${protocol}//${host}/api/v1/stream?token=${encodeURIComponent(this.token)}`;
        if (typeof loader !== 'undefined') {
            loader.update(12, 'Connecting to live stream...');
        }
        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = this.handleOpen.bind(this);
        this.socket.onmessage = this.handleMessage.bind(this);
        this.socket.onclose = this.handleClose.bind(this);
        this.socket.onerror = this.handleError.bind(this);
    }

    handleOpen(event) {
        this.hasOpened = true;
        this.reconnectAttempts = 0; // Reset
        if (typeof loader !== 'undefined') {
            loader.update(20, 'Live stream connected. Waiting for snapshot...');
        }
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
                console.warn("[Stream] Unknown event:", payload.event);
        }
    }

    handleClose(event) {
        if (!this.hasOpened && this.currentPortIndex < this.portCandidates.length - 1) {
            this.currentPortIndex++;
            this.connect();
            return;
        }
        this.attemptReconnect();
    }

    handleError(error) {
        console.error("[Stream] WebSocket error:", error);
        if (!this.hasOpened && this.currentPortIndex < this.portCandidates.length - 1) {
            this.currentPortIndex++;
            this.connect();
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
            if (typeof loader !== 'undefined') {
                loader.update(12, `Live stream disconnected. Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            }
            setTimeout(() => this.connect(), delay);
        } else {
            console.error("[Stream] Max reconnect attempts reached. Stream offline.");
            if (typeof loader !== 'undefined' && loader.status) {
                loader.status.innerHTML = "<span style='color: #ef4444;'>Live stream offline. Check /api/v1/stream connectivity.</span>";
            }
        }
    }
}

// Global instance
const warehouseStream = new WarehouseStream();

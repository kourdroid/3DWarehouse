// ═══════════════════════════════════════════════════════
//  SMATCH WAREHOUSE — CONFIGURATION
//  Global dimensional constants.
//  NOTE: These now serve as FALLBACK defaults if the 
//  server's Layout API is unavailable or empty.
//  The true coordinates are delivered via WebSocket.
// ═══════════════════════════════════════════════════════

const CONFIG = {
    aisles: 6,
    baysPerAisle: 12,
    levels: 6,
    rackDepth: 1.6,
    rackWidth: 2.8,
    aisleWidth: 3.5,
    levelHeight: 1.8,
    palletZoneLimit: 3,
    palletBaseHeight: 0.15,
    palletBaseWidth: 1.3,
    palletBaseDepth: 1.3,
    wallHeight: 14,
    wallPadding: 4,
};

const WAREHOUSE = {
    get width() { return CONFIG.baysPerAisle * CONFIG.rackWidth + CONFIG.wallPadding * 2; },
    get depth() { return CONFIG.aisles * (CONFIG.rackDepth + CONFIG.aisleWidth) + CONFIG.wallPadding; },
    get height() { return CONFIG.wallHeight; },
    get originX() { return -CONFIG.wallPadding; },
    get originZ() { return -CONFIG.aisleWidth; },
};

const ZONE_COLORS = {
    PALLET: 0x2563eb,
    PICKING: 0xf59e0b,
};

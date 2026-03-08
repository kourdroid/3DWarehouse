# Data Model: Project Analysis

*Note: Since this feature is primarily documentation/analysis of the existing system, this document outlines the core entities identified within the existing 3D Warehouse application rather than proposing new models.*

## Core Entities

### 1. `WarehouseLayout` (Backend Configuration)
Defines the physical boundaries and structural schema of the warehouse.
- **Fields**:
  - `aisles` (int): Number of aisles.
  - `baysPerAisle` (int): Number of bays per aisle.
  - `levels` (int): Number of vertical storage levels.
  - `rackWidth`, `levelHeight`, `rackDepth` (float): Dimensions.

### 2. `StorageUnit` / Location Marker (Frontend/Backend)
A distinct location coordinate in the 3D space.
- **Fields (Legacy mapping)**:
  - `id` (string): e.g., "A0-B1-L2-0"
  - `aisle`, `bay`, `level`, `subSlot` (int): Grid coordinates.
  - `type` (enum): 'PALLET' or 'BOX'.
- **Implicit Rules**: The frontend `warehouse.instancing.js` calculates exact `x,y,z` world coordinates from `a, b, l` dimensions.

### 3. `InventoryItem` (Live Data Payload)
The actual goods stored in a location, updated via WebSocket.
- **Fields**:
  - `location_code` (string): Maps to `StorageUnit.id`.
  - `status` (enum): 'OCCUPIED' or 'EMPTY'.
  - `quantity` (int): Number of units.
  - `sku` (string): Item identifier.
- **State Transitions**:
  - `EMPTY` -> `OCCUPIED`: Changes target instanced mesh color to occupied state based on type.
  - `OCCUPIED` -> `EMPTY`: Reverts to empty marker color (0x32ff6f).

# Implementation Plan: 2D Warehouse Builder

**Branch**: `003-2d-warehouse-builder` | **Date**: 2026-03-09 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-2d-warehouse-builder/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

A 2D top-down visual editor for configuring warehouse layouts that automatically generates a 3D digital twin. Operates entirely in the browser using Konva.js for the visual canvas, communicating with a backend FastAPI endpoint that drops and recreates the SQL-backed layout models (RackBay, StorageUnit, etc.) atomically.

## Technical Context

**Language/Version**: Python 3.11+, Vanilla JavaScript (ES6)
**Primary Dependencies**: FastAPI, SQLAlchemy (async_session), Konva.js (v9.x), Three.js (existing)
**Storage**: SQLite (development) / PostgreSQL (production) via SQLAlchemy
**Testing**: pytest (backend)
**Target Platform**: Web Browser (Desktop minimum 1280x720)
**Project Type**: Web Application (Backend API + Frontend SPA)
**Performance Goals**: Support 50,000 storage positions without degrading builder canvas performance
**Constraints**: Atomic layout transactions to guarantee referential integrity
**Scale/Scope**: Multi-tenant database structure (future), but current scope operates on a single active layout per user/account.

## Constitution Check

*GATE: Passed*

- [x] **Prime Directive**: Konva.js chosen over heavier frameworks based on documentation and proven fit for drag/drop canvas without build steps.
- [x] **100-Step Prediction**: Atomic POST and drop/recreate pattern chosen for simplicity now, scaling via database transactions. `pallets_per_bay` scales to real-world edge cases.
- [x] **Sovereign Audit**: Vanilla JS + Konva.js prevents needing React/Vite overhead. Simple hash routing prevents needing complex SPAs.
- [x] **Data Integrity**: Using UUIDs, foreign keys with CASCADE delete, and transactional flushing.

## Project Structure

### Documentation (this feature)

```text
specs/003-2d-warehouse-builder/
├── plan.md              # This file
├── research.md          # Technical decisions and architecture
├── data-model.md        # Database schema modifications
├── quickstart.md        # Dev setup and usage guide
├── contracts/           # API contracts (layout-api.md)
└── tasks.md             # Implementation steps (to be generated)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── api/v1/
│   │   ├── layout.py        # Add POST /configure endpoint
│   ├── models/
│   │   ├── layout.py        # Add location_code_pattern, floor_slots, pallets_per_bay
│   ├── schemas/
│   │   ├── layout.py        # Add Pydantic validation for POST payload
│   └── services/
│       └── layout_builder.py # Logic for DB transactional generation
└── tests/
    └── api/test_layout.py   # Test POST /configure

scripts/
├── builder/
│   ├── canvas.js            # Konva.js visual grid and zone drag/drop
│   ├── panel.js             # HTML param inputs and sliders
│   ├── commands.js          # Undo/redo stack
│   └── api.js               # Network calls
├── main.js                  # Hash routing logic added here
├── index.html               # Add container for #builder view
```

**Structure Decision**: Extending the existing project layout. The backend remains purely FastAPI inside `backend/app/` with clear separation of API, models, and services. The frontend remains simple scripts inside `scripts/`, but the builder components are logically grouped inside `scripts/builder/` to keep them cleanly separated from the 3D viewer logic.

## Complexity Tracking

N/A - No major architectural deviations or unnecessary complexity introduced. Database selection and transaction model adhere strictly to the Sovereign Audit.

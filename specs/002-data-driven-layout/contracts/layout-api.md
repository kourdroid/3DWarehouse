# Layout API Contract

## GET /api/v1/layouts/structure

Returns the full warehouse physical hierarchy for the 3D engine.

### Response: 200 OK

```json
{
  "id": "uuid-string",
  "name": "Main Facility",
  "dimensions": {
    "width": 50.0,
    "length": 100.0
  },
  "zones": [
    {
      "id": "uuid-string",
      "name": "Pallet Zone A",
      "color": "#2563eb",
      "type": "STANDARD_RACK",
      "offset": { "x": 0.0, "z": 0.0 },
      "dimensions": { "width": 20.0, "length": 50.0 },
      "aisles": [
        {
          "id": "uuid-string",
          "name": "A1",
          "orientation": "NORTH_SOUTH",
          "start": { "x": 0.0, "z": 0.0 },
          "bays": [
            {
              "id": "uuid-string",
              "name": "01",
              "sequence": 0,
              "width": 2.8,
              "levels": [
                {
                  "id": "uuid-string",
                  "level_number": 0,
                  "height": 0.2,
                  "max_weight_kg": 1000.0
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "uuid-string",
      "name": "Zone de Masse",
      "color": "#f59e0b",
      "type": "FLOOR_BULK",
      "offset": { "x": 30.0, "z": 0.0 },
      "dimensions": { "width": 20.0, "length": 30.0 },
      "aisles": []
    }
  ]
}
```

### Response: 404 Not Found

```json
{
  "detail": "No layout configured"
}
```

## WebSocket SNAPSHOT Event (Updated)

The existing `SNAPSHOT` event payload is extended to include the `layout` key:

```json
{
  "event": "SNAPSHOT",
  "data": {
    "layout": { ... },
    "inventory_state": [ ... ]
  }
}
```

The `layout` object follows the same schema as the `GET /api/v1/layouts/structure` response above.

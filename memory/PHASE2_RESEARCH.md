# Phase 2 Research Notes — Non-Xcel Utilities for Dumas, TX

**Date:** June 2026
**Properties:** 3 in Dumas, TX (1 personal, 2 LLC)

## Utility Mapping (Dumas, TX)

| Service | Provider | API Available? | Integration Strategy |
|---|---|---|---|
| ⚡ Electricity | Xcel Energy / SPS | ✅ Green Button | Phase 1 done, awaiting Xcel approval |
| 💧 Water + Sewer | Dumas City Utilities | ❌ Municipal — no API | OCR via GPT-4o Vision |
| 🔥 Natural Gas | West Texas Gas Utility (WTG) | ❌ No consumer API | OCR via GPT-4o Vision |
| 🗑️ Trash | Dumas City (bundled with water) | ❌ Municipal | Same OCR pass |
| 💧 Water (smart meters) | Possibly EyeOnWater (Badger Meter) | ⚠️ No public consumer API | Manual PDF export |

## EyeOnWater — Research Findings

- **Vendor:** Badger Meter (parent), product line "BEACON SaaS"
- **Consumer app:** Available on iOS/Android, gives end-users access to their smart-water-meter data
- **Public API:** ❌ **Does NOT exist** for third-party consumer apps. Confirmed via web search (June 2026).
- **Backend access:** Only through "BEACON Web Services / Import API" — requires utility-side credentials, not consumer-side.
- **For our use:** End-users can manually export their EyeOnWater data as PDF/CSV and upload to our OCR endpoint.

## Implementation: Universal Utility Bill OCR

### Backend (deployed)
- `POST /api/admin/utility-ocr/extract` — accepts PDF/image, returns structured JSON via GPT-4o Vision
- `POST /api/admin/utility-ocr/save-bill` — persists confirmed bill to `non_xcel_utility_bills`
- `GET  /api/admin/utility-ocr/non-xcel-bills` — list extracted bills

### MongoDB Collection: `non_xcel_utility_bills`
```
{
  _id, property_ids: [str], provider, bill_type,
  period_start, period_end, due_date, total_amount,
  usage_value, usage_unit, account_number, service_address,
  notes, source: "ocr", confidence, created_at, created_by
}
```

### LLM Prompt
GPT-4o (via Emergent LLM Key) is told to extract bills into a strict JSON schema and never invent data. Confidence scoring (0.0–1.0) drives the `needs_manual_review` flag at the 0.85 threshold.

## Future Phase 3 Ideas

1. **Admin Web UI for OCR**: drag-and-drop bill upload, confirm extracted fields, assign properties.
2. **Auto-prorating**: when multiple tenants share a property, split utility cost by occupancy or by formula.
3. **Mobile bill scanner**: tenants can take a photo of a paper bill, same OCR pipeline.
4. **Email forwarding**: dedicated inbox like `bills@rosshouserentals.com` — incoming emails with PDF attachments auto-trigger OCR.
5. **Tenant chart aggregation**: combine Xcel kWh + non-Xcel bills into a single "all utilities" view for tenants.

# Appointment Importer — Quick Start Guide

## Files Created

All files are located under `/apps/web/src/`:

```
lib/importers/
├── types.ts              # Shared type definitions
├── parse-csv.ts          # CSV file parser
├── parse-xlsx.ts         # Excel file parser
└── parse-ics.ts          # Google Calendar (.ics) parser

app/api/import/appointments/
└── route.ts              # POST /api/import/appointments endpoint
```

## Quick Integration

### 1. Install Dependencies

The implementation requires two npm packages:

```bash
npm install papaparse xlsx
# or with pnpm:
pnpm add papaparse xlsx
```

### 2. Import Files Ready to Use

```typescript
// Import the types
import type { ParsedAppointment, ImportResult } from "@/lib/importers/types";

// Import specific parsers if needed
import { parseCSV } from "@/lib/importers/parse-csv";
import { parseXLSX } from "@/lib/importers/parse-xlsx";
import { parseICS } from "@/lib/importers/parse-ics";
```

### 3. API Endpoint Usage

The endpoint is ready at: **`POST /api/import/appointments`**

**Request:**
```typescript
const formData = new FormData();
formData.append("file", file); // File object from input

const response = await fetch("/api/import/appointments", {
  method: "POST",
  body: formData,
  // Authorization header sent automatically by Next.js
});

const result: ImportResult = await response.json();
```

**Response:**
```typescript
{
  total: 10,           // Total rows in file
  imported: 9,         // Successfully imported
  skipped: 1,          // Failed/skipped rows
  errors: [
    { row: 5, message: "Already has appointment at this time" }
  ],
  appointmentIds: ["uuid-1", "uuid-2", ...]
}
```

## File Format Examples

### CSV Format
```csv
paciente,dni,email,telefono,fecha,hora,servicio,notas
Juan Pérez,12.345.678,juan@example.com,1234567890,2026-04-15,10:00,Consulta,Primera vez
María López,23.456.789,maria@example.com,0987654321,2026-04-16,14:30,Seguimiento,Chequeo
```

**Supported column names (case & accent insensitive):**
- Patient: `patient`, `paciente`, `nombre`, `full_name`, `client`
- DNI: `dni`, `document`, `cedula`
- Email: `email`, `correo`
- Phone: `phone`, `telefono`, `celular`
- Date: `date`, `fecha`
- Time: `time`, `hora`
- Service: `service`, `servicio`, `tipo`
- Notes: `notes`, `notas`, `description`

### XLSX Format
Same structure as CSV but in Excel. Use first sheet, flexible headers.

### ICS Format
Standard Google Calendar export. Just upload the `.ics` file directly.

## Testing Checklist

- [ ] Install papaparse and xlsx packages
- [ ] Create test CSV file with sample data
- [ ] Create test XLSX file with sample data
- [ ] Export calendar as .ics file
- [ ] Test CSV upload via `/api/import/appointments`
- [ ] Test XLSX upload via `/api/import/appointments`
- [ ] Test .ics upload via `/api/import/appointments`
- [ ] Verify appointments created in database
- [ ] Check that patients are created if not found
- [ ] Test with overlapping appointments (should be skipped)
- [ ] Test with invalid dates (should be skipped with error)
- [ ] Verify error reporting in response

## Common Use Cases

### Import Google Calendar
1. In Google Calendar, export as .ics
2. Upload directly to importer
3. Done! Appointments appear in BookMe

### Import from Excel
1. Prepare spreadsheet with columns: patient, date, time, service
2. Save as .xlsx
3. Upload to importer
4. Verify in results

### Import from CSV (Another System)
1. Export appointments as CSV from old system
2. Adjust column headers to match aliases
3. Upload to importer
4. Check error log for any issues

## Troubleshooting

### No appointments imported
- Check file format is .csv, .xlsx, or .ics
- Verify file has valid dates
- Check that patient names are not empty
- Review error list in response

### Some appointments skipped
- Check error messages in response
- Common causes:
  - Overlapping with existing appointments
  - Invalid date format
  - Missing patient name
  - Time outside schedule hours

### Wrong service assigned
- Service matching is partial (substring match)
- If exact service name not found, `service_id` is null
- Manual service assignment can be done afterward

### Wrong patient matched
- Matching uses DNI first (most reliable)
- Then falls back to name similarity
- If wrong patient matched, create with different name or dni

## Performance Notes

- Files up to 1000+ rows are processed synchronously
- Large files may take a few seconds
- Processing happens per-row (slow but safe)
- No timeout issues expected for typical use

## Security

✅ Requires authentication (Supabase Auth)
✅ Only authenticated professional can import
✅ Data validation on all inputs
✅ Database constraints enforced
✅ Professional ID from auth token (not user input)

## File Locations Reference

| File | Purpose | Exports |
|------|---------|---------|
| `lib/importers/types.ts` | Type definitions | `ParsedAppointment`, `ImportResult`, `ImportError` |
| `lib/importers/parse-csv.ts` | CSV parser | `parseCSV(content: string)` |
| `lib/importers/parse-xlsx.ts` | Excel parser | `parseXLSX(buffer: ArrayBuffer)` |
| `lib/importers/parse-ics.ts` | Calendar parser | `parseICS(content: string)` |
| `app/api/import/appointments/route.ts` | API endpoint | POST handler |

## Next Steps

1. Install dependencies: `npm install papaparse xlsx`
2. Test with sample files
3. Build UI for file upload (use existing form patterns)
4. Display ImportResult to user
5. Show error list if imports failed

## Support for Non-Standard Formats

The parsers are flexible but limited to:
- CSV with any structure (as long as headers are recognizable)
- Single-sheet XLSX files
- Standard iCalendar format

For other formats:
- Add new parser to `lib/importers/parse-{format}.ts`
- Update `detectFileType()` in route.ts
- Follow the same `ParsedAppointment` output format

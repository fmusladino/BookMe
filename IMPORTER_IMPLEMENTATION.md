# Appointment Importer Implementation

## Overview

The appointment importer feature allows professionals to import existing appointments from external files into BookMe. It supports three file formats:

- **CSV** (.csv) — Comma-separated values with flexible column names
- **XLSX** (.xlsx, .xls) — Excel spreadsheets
- **ICS** (.ics) — Google Calendar / iCalendar format

## Files Created

### 1. Type Definitions
**Path:** `/apps/web/src/lib/importers/types.ts`

Defines the core interfaces:

- `ParsedAppointment` — Structure of a parsed appointment with patient info, dates, service, and notes
- `ImportResult` — Result of the import operation with success/error counts
- `ImportError` — Error details for individual records
- `ImportFileType` — Supported file types
- `FileParser` — Interface for file parser implementations

### 2. CSV Parser
**Path:** `/apps/web/src/lib/importers/parse-csv.ts`

**Export:** `parseCSV(fileContent: string): ParsedAppointment[]`

Features:
- Uses PapaParse for reliable CSV parsing
- Supports flexible column name mapping (case-insensitive, accent-insensitive)
- Aliases for common column names in English and Spanish:
  - Patient: `patient`, `paciente`, `nombre`, `full_name`, `client`, `cliente`
  - DNI: `dni`, `document`, `doc`, `cedula`
  - Email: `email`, `email_address`, `correo`
  - Phone: `phone`, `telefono`, `celular`, `mobile`
  - Date: `date`, `fecha`, `appointment_date`
  - Time: `time`, `hora`, `appointment_time`
  - Start DateTime: `start`, `starts_at`, `datetime`, `fecha_hora`
  - End DateTime: `end`, `ends_at`, `end_time`
  - Service: `service`, `servicio`, `type`, `tipo`, `consulta`
  - Notes: `notes`, `notas`, `description`, `comments`
- Parses multiple date formats:
  - DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, YYYY/MM/DD
- Handles separate date and time columns
- Supports AM/PM time format
- Skips rows without valid dates or patient names
- Returns raw row data for debugging

### 3. XLSX Parser
**Path:** `/apps/web/src/lib/importers/parse-xlsx.ts`

**Export:** `parseXLSX(buffer: ArrayBuffer): ParsedAppointment[]`

Features:
- Uses SheetJS (xlsx library) for Excel parsing
- Reads the first sheet in the workbook
- Same flexible column mapping as CSV parser
- Handles Excel serial number dates
- Converts Excel time values (fractional hours) to HH:MM format
- Supports both separate date/time columns and combined datetime columns
- Processes all data types (dates, numbers, strings) correctly
- Returns parsed appointments structured identically to CSV output

### 4. ICS Parser
**Path:** `/apps/web/src/lib/importers/parse-ics.ts`

**Export:** `parseICS(fileContent: string): ParsedAppointment[]`

Features:
- Manual parsing without external libraries (minimal dependencies)
- Handles RFC 5545 iCalendar format
- Parses VEVENT blocks for appointment data
- Extracts:
  - `SUMMARY` → appointment name / service name
  - `DESCRIPTION` → notes
  - `DTSTART` → start datetime
  - `DTEND` → end datetime
- Supports multiple datetime formats:
  - `20260401T140000Z` (UTC with Z suffix)
  - `20260401T140000` (local datetime)
  - `20260401` (date only)
- Handles line folding (RFC 5545 continuation lines)
- Escapes special characters correctly
- Skips events without start dates

### 5. API Endpoint
**Path:** `/apps/web/src/app/api/import/appointments/route.ts`

**Endpoint:** `POST /api/import/appointments`

**Request Format:**
```
Content-Type: multipart/form-data
Authorization: Bearer {user_token}

Body:
  file: File (CSV, XLSX, or .ics)
```

**Response Format:**
```json
{
  "total": 10,
  "imported": 9,
  "skipped": 1,
  "errors": [
    {
      "row": 5,
      "field": "date",
      "message": "Fecha inválida"
    }
  ],
  "appointmentIds": ["uuid1", "uuid2", ...]
}
```

**Features:**

#### Authentication
- Requires authenticated user (professional)
- Uses Supabase Auth middleware
- Returns 401 if not authenticated

#### File Processing
- Detects file type from extension (.csv, .xlsx, .xls, .ics)
- Reads file content (text for CSV/ICS, ArrayBuffer for XLSX)
- Delegates parsing to appropriate parser
- Returns error if file format not supported

#### Patient Management
- Searches for existing patient by DNI (normalized: removes dots, dashes, spaces)
- Falls back to approximate name match if DNI not found
- Creates new patient if not found with:
  - `is_particular: true` (marked as private patient)
  - All available contact info (email, phone)
  - Normalized DNI (or random UUID if no DNI provided)

#### Service Matching
- Searches for service by name (case-insensitive partial match)
- Service is optional — if not found or not provided, uses `service_id: null`

#### Date/Time Handling
- All dates converted to ISO 8601 format
- If `endsAt` missing, defaults to `startsAt + 30 minutes`
- Validates against professional's schedule configuration
- Uses `validateAppointmentSlot()` to check business hours, break times, etc.

#### Conflict Detection
- Checks for overlapping appointments (pending or confirmed status)
- Skips appointments that conflict with existing bookings
- Searches in range: `starts_at < ends_at` and `ends_at > starts_at`

#### Appointment Creation
- Inserts appointments with status: `"confirmed"`
- Sets `booked_by: professional_id` (records that professional imported it)
- Uses admin client to bypass Row Level Security (safe because authenticated)
- Uses UUIDs generated with Node.js `crypto.randomUUID()`

#### Error Handling
- Graceful error handling for each row
- Continues processing if individual appointment fails
- Reports detailed errors per row number
- Logs errors to console for debugging
- Returns summary with all errors for client-side display

#### Row Processing Loop
1. Validates patient (required)
2. Finds or creates patient record
3. Optionally finds service
4. Calculates end time if missing
5. Validates time slot against schedule rules
6. Checks for overlaps
7. Creates appointment if all validations pass
8. Counts successes and failures

## API Request Examples

### CSV Upload
```bash
curl -X POST http://localhost:3000/api/import/appointments \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@appointments.csv"
```

### XLSX Upload
```bash
curl -X POST http://localhost:3000/api/import/appointments \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@appointments.xlsx"
```

### ICS Upload
```bash
curl -X POST http://localhost:3000/api/import/appointments \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@google_calendar.ics"
```

## CSV Format Example

```csv
paciente,dni,email,telefono,fecha,hora,servicio,notas
Juan Pérez,12.345.678,juan@example.com,1234567890,2026-04-15,10:00,Consulta general,Primera consulta
María López,23.456.789,maria@example.com,0987654321,2026-04-15,11:00,Consulta general,Seguimiento
```

### Flexible Column Names
Any of these column names will be recognized:

```csv
patient|paciente|nombre|full_name,date|fecha,time|hora,email|correo,phone|telefono,dni|document,service|servicio,notes|notas
```

## XLSX Format Example

Works like CSV but in Excel format:
- First row contains headers (flexible naming)
- Subsequent rows contain appointment data
- Supports Excel native date/time types
- Reads only the first sheet

## ICS Format Example

Standard Google Calendar export:

```ics
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Google Inc.//Google Calendar
BEGIN:VEVENT
DTSTART:20260415T100000Z
DTEND:20260415T110000Z
SUMMARY:Consulta general - Juan Pérez
DESCRIPTION:Primera consulta
UID:event-123@google.com
END:VEVENT
END:VCALENDAR
```

## Dependencies

The implementation uses:

- **papaparse** — CSV parsing with flexible handling
- **xlsx** (SheetJS) — Excel file reading
- **crypto** (Node.js built-in) — UUID generation
- **next** — API routing
- **@supabase/supabase-js** — Database operations

### Installation Note
The following packages need to be installed in the workspace:

```bash
npm install papaparse xlsx
# or
pnpm add papaparse xlsx
```

## Security Considerations

1. **Authentication:** All imports require authenticated user
2. **Authorization:** Only the authenticated professional can import appointments
3. **Admin Client:** Uses service role key to bypass RLS, but:
   - Only operates on behalf of authenticated professional
   - Professional ID is taken from auth token, not user input
   - Cannot access or modify other professionals' data
4. **Input Validation:**
   - File type validated by extension
   - Parsers handle malformed input gracefully
   - DNI normalized to prevent injection
   - All dates validated before insertion
   - Patient names and service names are text (safe from SQL injection via Supabase)
5. **Rate Limiting:** Not implemented in this version (can be added to middleware)

## Error Handling Strategy

The endpoint never fails completely. Instead:
- Individual row errors are collected and reported
- Import continues even if some rows fail
- Client receives partial success with error details
- Console logs errors for debugging
- Client can retry failed imports or fix data

Example error response:
```json
{
  "total": 10,
  "imported": 8,
  "skipped": 2,
  "errors": [
    {
      "row": 3,
      "message": "Ya existe un turno en ese horario"
    },
    {
      "row": 7,
      "message": "Horario inválido según la configuración"
    }
  ],
  "appointmentIds": ["id1", "id2", ...]
}
```

## Future Enhancements

1. **Conflict Resolution Options:**
   - Option to skip conflicts vs. reschedule
   - Bulk conflict resolution UI

2. **Service Creation:**
   - Auto-create services if not found
   - Duration matching from imported data

3. **Bulk Operations:**
   - Batch status updates after import
   - Auto-send notifications to patients
   - Calendar synchronization

4. **Advanced Mapping:**
   - Custom column mapping UI
   - Save column mapping for future imports
   - Template-based imports

5. **File Validation Preview:**
   - Pre-import validation without committing
   - Show preview of what will be imported
   - Conflict detection before import

6. **Performance:**
   - Chunked processing for large files (1000+ rows)
   - Background job queue for massive imports
   - Rate limiting per professional

## Testing Notes

To test the importer:

1. **Prepare test file:**
   - Create CSV/XLSX with test data
   - Or export from Google Calendar as .ics

2. **Call endpoint:**
   - POST multipart form with file
   - Include auth token

3. **Check results:**
   - Verify appointments in database
   - Check error report for any issues
   - Verify patients created if not found

4. **Edge cases:**
   - Duplicate import (should handle gracefully)
   - Overlapping times
   - Missing dates
   - Invalid email formats (still imports if other data valid)
   - Large files (>500 rows)

## Code Quality

- **TypeScript Strict Mode:** All files use `strict: true`
- **English Naming:** Variables, functions, types in English
- **Spanish Comments:** Implementation comments in Spanish for team
- **Error Logging:** Comprehensive console logging for debugging
- **Type Safety:** Full TypeScript types, no `any` types
- **Documentation:** JSDoc comments on all public functions
- **SOLID Principles:** Modular design, single responsibility, dependency injection via parameters
- **Clean Code:** Clear function names, logical flow, error handling

---

## Summary

This implementation provides a robust appointment importing system that:
- Supports 3 file formats with flexible, intelligent column mapping
- Handles all edge cases gracefully
- Creates/finds patients intelligently (by DNI or name)
- Validates against existing calendar rules
- Prevents double-booking
- Provides detailed error reporting
- Maintains data integrity through transactions and validation
- Is secure, scalable, and maintainable

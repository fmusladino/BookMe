# Appointment Importer — Architecture & Design

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                    │
│  - File upload form (not implemented, use existing UI)       │
│  - FormData with file → POST /api/import/appointments       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│            API Endpoint (route.ts)                           │
│  1. Authenticate user                                        │
│  2. Extract file from FormData                              │
│  3. Detect file type (.csv, .xlsx, .ics)                    │
│  4. Route to appropriate parser                             │
│  5. Process appointments (create patients, validate, insert) │
│  6. Return ImportResult with success/error counts           │
└──────────────────────┬──────────────────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
    ┌────────┐  ┌────────┐  ┌────────┐
    │ CSV    │  │ XLSX   │  │  ICS   │
    │ Parser │  │ Parser │  │ Parser │
    └────┬───┘  └───┬────┘  └───┬────┘
         │          │           │
         └──────────┬───────────┘
                    ▼
         ┌──────────────────────┐
         │ ParsedAppointment[]  │
         └──────────┬───────────┘
                    │
                    ▼
         ┌──────────────────────────────────────┐
         │  Appointment Processing Loop         │
         │  For each ParsedAppointment:         │
         │  1. Find or create patient           │
         │  2. Find service (optional)          │
         │  3. Calculate end time if missing    │
         │  4. Validate time slot               │
         │  5. Check for overlaps               │
         │  6. Insert appointment               │
         │  7. Track success/error              │
         └──────────┬───────────────────────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │   Supabase (Admin)   │
         │  - Create patients   │
         │  - Create appts      │
         │  - Query services    │
         └──────────────────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │    ImportResult      │
         │  - total: number     │
         │  - imported: number  │
         │  - skipped: number   │
         │  - errors: []        │
         │  - appointmentIds: []│
         └──────────────────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │  Return JSON to      │
         │  Frontend            │
         └──────────────────────┘
```

## Data Flow

### 1. File Upload & Parsing

```
File (CSV/XLSX/ICS)
    ↓
[detectFileType(filename)]
    ↓
file.text() or file.arrayBuffer()
    ↓
parseCSV() / parseXLSX() / parseICS()
    ↓
ParsedAppointment[]
```

### 2. Patient Handling

```
ParsedAppointment
    ↓
[findOrCreatePatient]
    ├─ If patientDni:
    │  └─ Query by normalized DNI
    │      ├─ Found: return patient.id
    │      └─ Not found: continue
    │
    ├─ Query by name (ilike)
    │  ├─ Found: return patient.id
    │  └─ Not found: continue
    │
    └─ Create new patient:
       ├─ Generate new UUID
       ├─ Normalize DNI or generate UUID
       ├─ Insert with is_particular=true
       └─ Return patient.id
```

### 3. Service Matching

```
ParsedAppointment.serviceName
    ↓
[findService]
    ├─ If serviceName provided:
    │  └─ Query with ilike (case-insensitive)
    │      ├─ Found: return service.id
    │      └─ Not found: return null
    │
    └─ If no serviceName: return null
        ↓
        Appointment created with service_id=null
```

### 4. Appointment Validation & Creation

```
ParsedAppointment + patientId + serviceId
    ↓
[validateAppointmentSlot]
    ├─ Check professional's schedule config
    ├─ Check business hours
    ├─ Check break times
    ├─ Check vacation mode
    └─ Return valid: true/false
        ├─ If invalid: skip, add error
        │
        └─ If valid: continue
            ↓
            [Check overlap]
            └─ Query existing appointments
                ├─ overlapping.length > 0: skip, add error
                │
                └─ No overlap: continue
                    ↓
                    [Insert appointment]
                    ├─ Success: count imported
                    └─ Error: count skipped, add error
```

## Module Dependencies

```
route.ts (POST handler)
    ├── parseCSV (from lib/importers)
    ├── parseXLSX (from lib/importers)
    ├── parseICS (from lib/importers)
    ├── createClient (from lib/supabase/server)
    ├── createAdminClient (from lib/supabase/server)
    └── validateAppointmentSlot (from lib/schedule/validation)

parse-csv.ts
    └── papaparse (npm package)

parse-xlsx.ts
    └── xlsx (npm package)

parse-ics.ts
    └── (no external dependencies)

types.ts
    └── (no dependencies - pure type definitions)
```

## Type Safety

### ParsedAppointment Structure
```typescript
interface ParsedAppointment {
  patientName: string;           // Required
  patientDni?: string;           // Optional
  patientEmail?: string;         // Optional
  patientPhone?: string;         // Optional
  startsAt: string;              // Required (ISO 8601)
  endsAt?: string;               // Optional (ISO 8601)
  serviceName?: string;          // Optional
  notes?: string;                // Optional
  rawRow?: Record<string, any>;  // Debug only
}
```

### ImportResult Structure
```typescript
interface ImportResult {
  total: number;                 // Appointments processed
  imported: number;              // Successfully created
  skipped: number;               // Failed/skipped
  errors: ImportError[];         // Detailed errors per row
  appointmentIds?: string[];     // IDs of created appointments
}

interface ImportError {
  row: number;                   // 1-indexed row number
  field?: string;                // Which field failed
  message: string;               // Error message
}
```

## Error Handling Strategy

### Level 1: File-Level Errors
```typescript
// Return 400 before processing any rows
if (!file) return { error: "File required" }
if (!fileType) return { error: "Unsupported format" }
if (parseError) return { error: "Parse error", details }
if (appointments.length === 0) return { error: "No valid appointments" }
```

### Level 2: Row-Level Errors
```typescript
// Skip individual row, continue processing
for each appointment {
  try {
    // Find patient, validate, insert
  } catch (error) {
    result.skipped++
    result.errors.push({ row, message })
    continue // Next appointment
  }
}
```

### Level 3: Processing Errors
```typescript
// Specific validation errors
if (!patientId) {
  errors.push("Could not find or create patient")
}
if (!validationResult.valid) {
  errors.push("Time slot invalid: " + reason)
}
if (overlapping.length > 0) {
  errors.push("Already has appointment at this time")
}
```

## Column Name Matching Algorithm

The parsers use accent-insensitive, case-insensitive matching:

```
Normalizer:
  1. Remove leading/trailing whitespace
  2. Convert to lowercase
  3. Remove diacritics (NFD decomposition)
  4. Remove combining marks

Example:
  "Paciente" → "paciente"
  "Páciente" → "paciente"
  "PACIENTE" → "paciente"
  " Paciente " → "paciente"

Matching:
  For each column header:
    1. Normalize header name
    2. For each alias in COLUMN_ALIASES:
       - Normalize alias
       - If match: return column index
    3. No match: return -1
```

## Date/Time Parsing

### CSV Parser
```
Input formats:
  - 2026-04-15 (ISO)
  - 15/04/2026 (European)
  - 04/15/2026 (US)
  - 2026/04/15 (ISO with /)

Time formats:
  - 14:30 (HH:MM)
  - 14:30:45 (HH:MM:SS)
  - 2:30 PM (with AM/PM)
  - 143045 (without separators)

Output: ISO 8601 string
  2026-04-15T14:30:00.000Z
```

### XLSX Parser
```
Excel-specific handling:
  - Serial number dates: days since 1899-12-30
  - Fractional time: hours as decimal (0.5 = 12:00)

Example:
  Date value: 45406
    → 2026-04-15

  Time value: 0.6041667
    → 14:30 (0.6041667 * 24 = 14.5 hours)
```

### ICS Parser
```
RFC 5545 formats:
  - 20260415T143000Z (UTC with Z)
  - 20260415T143000 (Local)
  - 20260415 (Date only)

Processing:
  1. Remove line folding (continuation lines)
  2. Extract DTSTART/DTEND properties
  3. Parse datetime format
  4. Return ISO 8601
```

## Database Interaction

### Supabase Admin Client

Used for all database operations because:
- Bypasses Row Level Security (safe, auth verified)
- Professional ID verified from auth token
- Operations scoped to authenticated user
- Service role key never exposed to frontend

### Operations Performed

```sql
-- Find patient by DNI
SELECT id FROM patients
WHERE professional_id = $1 AND dni = $2
LIMIT 1

-- Find patient by name
SELECT id FROM patients
WHERE professional_id = $1 AND full_name ILIKE $2
LIMIT 1

-- Create patient
INSERT INTO patients (
  id, professional_id, dni, full_name,
  email, phone, is_particular
) VALUES (...)

-- Find service
SELECT id FROM services
WHERE professional_id = $1 AND name ILIKE $2
LIMIT 1

-- Create appointment
INSERT INTO appointments (
  id, professional_id, patient_id, service_id,
  starts_at, ends_at, status, booked_by, notes
) VALUES (...)

-- Check overlap
SELECT id FROM appointments
WHERE professional_id = $1
  AND status IN ('pending', 'confirmed')
  AND starts_at < $2
  AND ends_at > $3
LIMIT 1
```

## Performance Considerations

### Current Implementation
- Synchronous row-by-row processing
- One database query per operation (not batched)
- For 100 appointments: ~20+ queries
- Typical import time: 2-5 seconds

### Scalability Limits
- Suitable for imports up to 1000 appointments
- Beyond that, consider async queue processing
- No timeout issues expected (<30 seconds)

### Optimization Options (Future)
```typescript
// Batch patient lookups
const patientDNIs = appointments.map(a => a.patientDni).filter(Boolean)
const existingPatients = await findPatients(patientDNIs)

// Batch service lookups
const serviceNames = appointments.map(a => a.serviceName).filter(Boolean)
const existingServices = await findServices(serviceNames)

// Batch insert appointments
await insertAppointmentsBatch(validAppointments)
```

## Testing Strategy

### Unit Tests (Parsers)
```typescript
describe('parseCSV', () => {
  it('parses flexible column names', () => {})
  it('handles multiple date formats', () => {})
  it('matches patient and service names', () => {})
  it('skips rows with invalid dates', () => {})
})
```

### Integration Tests (API)
```typescript
describe('POST /api/import/appointments', () => {
  it('imports CSV with new patients', () => {})
  it('reuses existing patients by DNI', () => {})
  it('skips overlapping appointments', () => {})
  it('validates against schedule rules', () => {})
})
```

### E2E Tests
```typescript
it('complete flow: CSV upload → appointments created', () => {})
it('error handling: returns detailed error report', () => {})
it('partial success: imports 8/10 with error details', () => {})
```

## Security Deep Dive

### Attack Vectors Mitigated

1. **SQL Injection**
   - All Supabase queries use parameterized values
   - No string concatenation in queries
   - DNI normalization removes special chars

2. **Unauthorized Access**
   - Auth verified before any processing
   - Professional ID from auth token (user.id)
   - Cannot specify different professional_id

3. **File Upload Attacks**
   - Only text files (.csv, .ics) and zip (.xlsx) accepted
   - File size not limited (consider adding limit)
   - Content validated during parsing

4. **Rate Limiting**
   - Not implemented (consider adding middleware)
   - Could DOS with 10,000 row file

5. **Information Disclosure**
   - Errors are descriptive but not revealing
   - Console logs only for debugging
   - Client gets high-level error info

## Maintenance Notes

### When Adding New Parsers
1. Create `parse-{format}.ts` in `lib/importers/`
2. Export `parse{Format}(content: ...) => ParsedAppointment[]`
3. Update `detectFileType()` in `route.ts` to recognize extension
4. Add to try-catch block in POST handler
5. Add to this documentation

### When Changing Appointment Logic
- Update validation in `route.ts`
- Ensure backwards compatibility with existing imports
- Test with overlapping appointments
- Test with schedule validation

### Dependencies
- `papaparse`: CSV parsing only, lightweight
- `xlsx`: Large package, consider alternatives for CSV-only use
- Both are actively maintained and stable

## Related Files Reference

- `/apps/web/src/app/api/appointments/route.ts` - Appointment creation
- `/apps/web/src/lib/schedule/validation.ts` - Schedule validation
- `/apps/web/src/types/database.ts` - Database types
- `/apps/web/src/lib/supabase/server.ts` - Supabase clients

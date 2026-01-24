# Parsing System Audit - Analysis & Fix Plan

**Date**: 2026-01-23
**Audit Period**: Last hour of real job data (875 jobs analyzed)

## Executive Summary

**Statistics**:
- 875 total jobs created
- 866 (99%) have origin parsed
- 818 (93.5%) have destination parsed
- 875 (100%) have phone numbers
- **57 jobs (6.5%) missing destinations** due to parsing errors

### Critical Bugs Found: 5 major issues affecting origin/destination parsing

---

## Detailed Error Analysis

### Bug #1: Plate Codes from Phone Numbers (CRITICAL)
**Frequency**: High - affects any message with phone ending in 01-81

**Examples**:
- `0 541 281 09 67` → "67" parsed as **Zonguldak**
- `0 531 399 23 23` → potential "40" from context → **Kırşehir**

**Root Cause**: `looksLikePlateCode()` in `location.ts:90-100` checks phone patterns but:
1. Only checks for plate codes WITHIN phone number patterns
2. Doesn't check if the number IS the last digits of a phone
3. Pattern `05\\d{2}\\s*\\d{3}\\s*\\d{2}\\s*${token}` only matches `xx xx` format, not `09 67` (two separate numbers)

**Affected File**: `packages/parser/src/extractors/location.ts:90-100`

**Fix**:
```typescript
// Add check for numbers at end of phone-like sequences
const phoneEndPattern = new RegExp(`\\d{2}\\s*${token}\\s*$|\\d{2}\\s+${token}\\b`);
if (phoneEndPattern.test(context)) {
  return false;
}
```

---

### Bug #2: "TEKER" (Wheels) Parsed as Plate Code (CRITICAL)
**Frequency**: High - affects any message with "10 TEKER", "8 TEKER", "6 TEKER"

**Example**:
- `ADANA_İSTlYEŞİLKÖY HAFİF KAPALI 10 TEKER` → "10" parsed as **Balıkesir**

**Root Cause**: `looksLikePlateCode()` line 67 excludes measurement units but missing "teker"

**Affected File**: `packages/parser/src/extractors/location.ts:67`

**Current Code**:
```typescript
const measurementPattern = new RegExp(`${token}\\s*(km|m|cm|mm|mt|metre|meter|ton|kg|lt|saat|dakika|gun|arac|tir|uzunluk|genislik|yukseklik)`);
```

**Fix**: Add "teker" to the measurement units:
```typescript
const measurementPattern = new RegExp(`${token}\\s*(km|m|cm|mm|mt|metre|meter|ton|kg|lt|saat|dakika|gun|arac|tir|teker|uzunluk|genislik|yukseklik)`);
```

---

### Bug #3: "YÜKLER" Header Pattern Not Recognized (HIGH)
**Frequency**: Medium - affects grouped load messages

**Example**:
```
*ÇORLU YÜKLER*
ELAZIĞ TIR
BAŞAKŞEHİR TIR
TUZLA TIR
```
**Expected**: Origin = Çorlu, Destinations = [Elazığ, Başakşehir, Tuzla]
**Actual**: Origin = Elazığ, Destination = Konya

**Root Cause**: No pattern in `extractAllRoutes()` or `extractOneOriginMultipleDestinations()` recognizes the "*CITY YÜKLER*" header format

**Affected File**: `packages/parser/src/extractors/location.ts:356-455`

**Fix**: Add new pattern in `extractAllRoutes()`:
```typescript
// Pattern for "CITY YÜKLER" header followed by list of destinations
const yuklerHeaderPattern = /\*?([A-Za-z\u00C0-\u017F]+)\s+Y[UÜ]KLER?\*?\s*\n([\s\S]+?)(?=\n\*?[A-Za-z\u00C0-\u017F]+\s+Y[UÜ]KLER?|$)/gi;
```

---

### Bug #4: "(Çıkış:CITY)" Format Not Parsed (MEDIUM)
**Frequency**: Low - affects structured load list messages

**Example**:
```
🚛 *YÜKLEME LİSTESİ
(Çıkış:AYDIN)
🏁 ORDU
📞 İletişim: +90 543 977 72 96 -TAYFUN
```
**Expected**: Origin = Aydın, Destination = Ordu
**Actual**: Origin = Aydın, Destination = Batman (phantom)

**Root Cause**:
1. "Çıkış:" format not in `ROUTE_PATTERNS` - so ORDU is not detected as destination
2. **"Batman" (plate 72) extracted from phone number `+90 543 977 72 96`** - Bug #1 strikes again!

**Affected File**: `packages/parser/src/extractors/location.ts:116-128`

**Fix**: Add pattern for "(Çıkış:CITY)":
```typescript
// "(Çıkış:ANTALYA)" format - explicit origin marker
/\(?\s*[CÇ][IİI]K[IİI][SŞ]\s*:\s*([A-Za-z\u00C0-\u017F]+)\s*\)?/gi
```

---

### Bug #5: Hadımköy Not in Districts Database (MEDIUM)
**Frequency**: Medium - affects messages with popular Istanbul industrial areas

**Example**:
- `BURSA ALAADDİNBEY - HADIMKÖY` → Destination = **Kırşehir** instead of Istanbul

**Root Cause**:
- "Hadımköy" is NOT in the districts database (only "Hadim" exists, which is in Konya!)
- "Kırşehir" (plate 40) likely appearing from phone number context
- Hadımköy is a popular industrial area in Istanbul's Arnavutköy district

**Affected File**: `packages/shared/src/constants/districts.ts`

**Fix**: Add Hadımköy as a new district entry mapping to Istanbul:
```typescript
{ name: 'Hadımköy', normalized: 'hadimkoy', provinceCode: 34, provinceName: 'Istanbul' },
```

**Note**: Arnavutköy already exists (line 493), but Hadımköy is commonly used as a separate location reference in logistics.

---

## Jobs Analyzed with Errors

| Job ID | Raw Text (truncated) | Expected | Actual | Issue |
|--------|---------------------|----------|--------|-------|
| 207f315f | ÇATALCA YÜKLER / İZMİT | Çatalca→Kocaeli | Çatalca→**Zonguldak** | Phone "67" as plate |
| bb77e90a | ADANA_ANKARA / 10 TEKER | Adana→Ankara | Adana→**Balikesir** | "10" TEKER as plate |
| 503f453e | BURSA - HADIMKÖY | Bursa→Istanbul | Bursa→**Kirsehir** | Hadımköy not resolved |
| b2448e31 | ÇORLU YÜKLER / ELAZIĞ | Çorlu→Elazığ | Elazığ→Konya | YÜKLER header missed |
| dd4529bb | (Çıkış:AYDIN) / ORDU | Aydın→Ordu | Aydın→**Batman** | Çıkış format missed |

---

## Recommended Fix Priority

### Priority 1 (Fix Immediately) - CRITICAL
These two bugs together cause ~80% of the phantom province issues:

1. **Bug #1**: Improve phone number end detection - 10 line change
   - Impact: Prevents Zonguldak (67), Batman (72), Kırşehir (40), etc. from phone numbers
   - Root cause of multiple job errors

2. **Bug #2**: Add "teker" to measurement filter - 1 line change
   - Impact: Prevents Balıkesir (10) from "10 TEKER" patterns
   - Very common in logistics messages

### Priority 2 (Fix This Week) - MEDIUM
3. **Bug #5**: Add Hadımköy district - 1 line change
   - Popular industrial area in Istanbul
   - Easy fix, high impact for Istanbul routes

### Priority 3 (Future Enhancement) - LOW
4. **Bug #3**: Add YÜKLER header pattern - 30 line change
   - Complex pattern, less frequent

5. **Bug #4**: Add Çıkış: format support - 10 line change
   - Structured format, less common

---

## Implementation Plan

### Step 1: Fix Plate Code False Positives (HIGHEST PRIORITY)
**File**: `packages/parser/src/extractors/location.ts`

```typescript
// Line 67: Add "teker" to measurement units
const measurementPattern = new RegExp(
  `${token}\\s*(km|m|cm|mm|mt|metre|meter|ton|kg|lt|saat|dakika|gun|arac|tir|teker|uzunluk|genislik|yukseklik)`
);

// Lines 90-100: Improve phone number detection - CRITICAL FIX
// Current patterns miss cases where plate code IS at end of phone
// Add explicit check for phone number endings like "72 96" or "09 67"
const phoneEndPattern = new RegExp(`\\d{2}\\s+${token}\\s*$|\\d{3}\\s+${token}\\s+\\d{2}\\s*$`);
if (phoneEndPattern.test(context)) {
  return false;
}

// Also check if token appears right after phone-like sequence
const afterPhonePattern = new RegExp(`05\\d{2}[\\s\\-\\.]*\\d{3}[\\s\\-\\.]*\\d{2}[\\s\\-\\.]*${token}`);
if (afterPhonePattern.test(context)) {
  return false;
}
```

### Step 2: Add Missing District - Hadımköy
**File**: `packages/shared/src/constants/districts.ts`

Add in Istanbul section (around line 493):
```typescript
{ name: 'Hadımköy', normalized: 'hadimkoy', provinceCode: 34, provinceName: 'Istanbul' },
```

### Step 3: Add YÜKLER Header Pattern (MEDIUM PRIORITY)
**File**: `packages/parser/src/extractors/location.ts` - `extractAllRoutes()` function

Add pattern recognition for:
```
*ÇORLU YÜKLER*
ELAZIĞ TIR
BAŞAKŞEHİR TIR
```

### Step 4: Add Çıkış: Format Support (LOW PRIORITY)
**File**: `packages/parser/src/extractors/location.ts` - `ROUTE_PATTERNS`

Add pattern for `(Çıkış:CITY)` format

---

## Files to Modify

| File | Changes | Lines Affected |
|------|---------|----------------|
| `packages/parser/src/extractors/location.ts` | Add "teker" to filters, improve phone detection | ~67, ~90-100 |
| `packages/shared/src/constants/districts.ts` | Add Hadımköy district | ~493 (Istanbul section) |
| `packages/parser/src/__tests__/extractors/location.test.ts` | Add regression tests | New tests |

---

## Testing Strategy

1. Create test cases for each bug using real raw_text from database:
   - Phone number ending: `+90 543 977 72 96` should NOT produce Batman (72)
   - TEKER pattern: `10 TEKER` should NOT produce Balıkesir (10)
   - Hadımköy: `HADIMKÖY` should resolve to Istanbul

2. Run unit tests: `pnpm test --filter=@turkish-logistics/parser`

3. Deploy and verify with real data: Check next 100 jobs for phantom provinces

---

## Key Insight

**The #1 issue causing wrong destinations is plate codes being extracted from phone numbers.**

Turkish plate codes (1-81) can appear anywhere in phone numbers:
- `0541 281 09 67` → 67 = Zonguldak
- `0543 977 72 96` → 72 = Batman
- `0531 399 23 23` → potential false positives

The `looksLikePlateCode()` function needs stronger phone number filtering.

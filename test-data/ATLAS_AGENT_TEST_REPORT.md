# Atlas Agent Test Report

**Date:** 2026-01-25
**Model Tested:** Atlas-1 (Modal endpoint)
**Test Coverage:** 99 custom test cases across 10 categories

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Overall Pass Rate** | 83.8% (83/99) |
| **Core Search Accuracy** | 100% (basic, suffix, multi-dest, region, vehicle) |
| **Critical Failures** | Context handling (10%), Intent classification (70%) |

The Atlas agent performs **excellently** on core logistics search tasks but has **significant gaps** in conversational context handling and some intent classifications.

---

## Category Breakdown

| Category | Passed | Total | Pass Rate | Status |
|----------|--------|-------|-----------|--------|
| basic_search | 10 | 10 | **100%** | ✅ Excellent |
| suffix_based | 10 | 10 | **100%** | ✅ Excellent |
| multi_destination | 10 | 10 | **100%** | ✅ Excellent |
| region_search | 10 | 10 | **100%** | ✅ Excellent |
| vehicle | 10 | 10 | **100%** | ✅ Excellent |
| slang | 9 | 10 | **90%** | ✅ Good |
| edge_case | 9 | 9 | **100%** | ✅ Excellent |
| intra_city | 7 | 10 | **70%** | ⚠️ Needs Work |
| intent | 7 | 10 | **70%** | ⚠️ Needs Work |
| context | 1 | 10 | **10%** | 🔴 CRITICAL |

---

## Top 10 Issues to Fix (Priority Order)

### 🔴 Issue #1: Context/Confirmation Words Return "other" or "unknown"
**Severity:** CRITICAL
**Impact:** 9 failed tests
**Category:** context

Short confirmation/negation words are not recognized without conversation context.

| Input | Expected | Actual | Response |
|-------|----------|--------|----------|
| `evet` | confirmation | other | "hmm bunu bilmiyorum..." |
| `tamam` | confirmation | other | "bu benim alanım değil abi..." |
| `olur` | confirmation | other | "hmm bunu bilmiyorum..." |
| `hayir` | negation | other | "hmm bunu bilmiyorum..." |
| `istemiyorum` | negation | other | "bu benim alanım değil abi..." |

**Root Cause:** Atlas model doesn't maintain conversation context - these words need the previous assistant message to understand intent.

**Fix:**
1. Pass conversation history to Atlas model (not just current message)
2. Or implement keyword-based fallback for common patterns:
   - After "civarinda bakayim mi?" → "evet/tamam/olur" = confirmation
   - After showing results → "hayir/istemiyorum" = negation

---

### 🔴 Issue #2: Thanks/Goodbye Return "unknown"
**Severity:** HIGH
**Impact:** 4 failed tests
**Category:** context

| Input | Expected | Actual | Response |
|-------|----------|--------|----------|
| `tesekkurler` | thanks | unknown | "rica ederim abi" |
| `sagol` | thanks | unknown | "rica ederim abi" |
| `gorusuruz` | goodbye | unknown | "gorusuruz abi, kolay gelsin" |
| `bb` | goodbye | unknown | "gorusuruz abi, kolay gelsin" |
| `eyvallah` | thanks | unknown | "rica ederim abi" |

**Interesting:** The agent RESPONDS correctly but classifies intent as "unknown"!

**Root Cause:** Atlas model's keyword fallback handles the response but doesn't set proper intent.

**Fix:** In `atlas-agent.ts`, update the keyword-based intent detection:
```typescript
// Add these patterns
const THANKS_PATTERNS = /^(tesekkur|sagol|eyvallah|saol)/i;
const GOODBYE_PATTERNS = /^(gorusuruz|bb|bye|hoşçakal|hoscakal)/i;
```

---

### 🟡 Issue #3: Some Intra-City Searches Return "other"
**Severity:** MEDIUM
**Impact:** 3 failed tests
**Category:** intra_city

| Input | Expected | Actual | Response |
|-------|----------|--------|----------|
| `esenyurt kucukcekmece` | search/intra_city | other | Shows Istanbul jobs ✅ |
| `kadikoy umraniye` | search/intra_city | other | Shows Istanbul jobs ✅ |
| `bagcilar basaksehir` | search/intra_city | other | Shows Istanbul jobs ✅ |

**Interesting:** The RESPONSE is correct (shows Istanbul jobs), but intent is misclassified as "other".

**Root Cause:** Atlas model correctly detects same-city districts but returns "other" intent instead of "search" or "intra_city".

**Fix:** Update Atlas client to map "other" → "search" when the response contains job listings.

---

### 🟡 Issue #4: "ucretli mi" (Pricing) Returns "other"
**Severity:** MEDIUM
**Impact:** 1 failed test
**Category:** intent

| Input | Expected | Actual | Response |
|-------|----------|--------|----------|
| `ucretli mi` | pricing | other | "bu benim alanım değil abi..." |

**Root Cause:** "fiyat ne" works but "ucretli mi" doesn't - missing synonym.

**Fix:** Add to pricing patterns:
```typescript
const PRICING_PATTERNS = /fiyat|ucret|para|ne kadar|kac lira|bedava|ucretsiz/i;
```

---

### 🟡 Issue #5: "yardim" (Help) Returns "other"
**Severity:** MEDIUM
**Impact:** 1 failed test
**Category:** intent

| Input | Expected | Actual | Response |
|-------|----------|--------|----------|
| `yardim` | help | other | "sadece yük işine bakıyorum..." |

**Root Cause:** Help intent not recognized.

**Fix:** Add help patterns:
```typescript
const HELP_PATTERNS = /^(yardim|yardım|nasil|nasıl kullan)/i;
```

---

### 🟡 Issue #6: "13 60 ile cikiyorum istanbul" Misclassified
**Severity:** LOW
**Impact:** 1 failed test
**Category:** slang

| Input | Expected | Actual | Response |
|-------|----------|--------|----------|
| `13 60 ile cikiyorum istanbul` | search/vehicle_info | intra_city | Shows Istanbul jobs ✅ |

**Analysis:** The response is correct - it shows Istanbul outbound jobs. The intent classification as "intra_city" is incorrect but harmless since the behavior is good.

**Fix (Low Priority):** This is a borderline case - "cikiyorum" (I'm leaving) with location could be search OR vehicle_info. Current behavior is acceptable.

---

## Strengths Identified

### ✅ Perfect Core Search Performance
- All basic city-to-city searches work (100%)
- Turkish suffix parsing perfect: `-dan/-den`, `-a/-e/-ya/-ye`
- Apostrophe handling works: `istanbul'dan ankara'ya`

### ✅ Excellent Multi-Destination Handling
- All patterns work: `istanbul ankara bursa`, `veya`, `yada`, `ya da`
- Grouped response format is excellent

### ✅ Region Searches Work Perfectly
- All 7 regions recognized: Marmara, Ege, Akdeniz, Karadeniz, Ic Anadolu, Dogu Anadolu, Guneydogu
- Compound forms work: `icanadolu`, `doguanadolubolgesi`

### ✅ City Aliases & Abbreviations
- `antep` → `gaziantep` ✅
- `urfa` → `sanliurfa` ✅
- `izmit` → `kocaeli` ✅
- `afyon` → `afyonkarahisar` ✅
- `ank ist` → `ankara istanbul` ✅

### ✅ Vehicle & Slang Recognition
- TIR, kamyon, tenteli, frigo, damperli, lowbed, panelvan all work
- `1360`, `13:60`, `13 60` all parsed correctly
- `parsiyel`, `komple`, `parca yuk`, `nakliye`, `sefer` recognized

### ✅ Edge Case Robustness
- Handles uppercase, extra whitespace, dash separators
- English patterns work: "from izmir to bursa"
- CSV format works: "istanbul,ankara,izmir"
- Gibberish handled gracefully

---

## Latency Analysis

| Category | Avg Latency | Notes |
|----------|------------|-------|
| Cache hits | ~2-3s | Excellent |
| Cold starts | ~30-32s | Modal serverless issue |
| Keyword fallback | ~0.7s | Very fast |

**Observation:** About 30% of requests hit cold starts (~31s). Consider:
1. Keep-warm pings every 5 minutes
2. Provisioned concurrency on Modal

---

## Recommendations

### Immediate Fixes (This Week)
1. **Add context handling** - Pass 2-3 previous messages to Atlas
2. **Expand keyword fallback** for thanks/goodbye/help patterns
3. **Fix intent classification** when response contains jobs but intent is "other"

### Short-Term Improvements (This Month)
4. Add "ucretli mi" to pricing patterns
5. Add "yardim" to help patterns
6. Consider keeping Modal endpoint warm

### Future Considerations
7. Fine-tune Atlas-1 model on failed test cases
8. Add conversation state machine for multi-turn flows
9. Compare Atlas vs GPT on production traffic (10% sample test ready)

---

## Test Infrastructure Created

| File | Purpose |
|------|---------|
| `scripts/atlas-test/fetch-conversations.ts` | Pull conversations from DynamoDB |
| `scripts/atlas-test/run-tests.ts` | Full production test runner |
| `scripts/atlas-test/run-sample-tests.ts` | Quick 50-conversation sample |
| `scripts/atlas-test/custom-tests.ts` | 100 custom test cases |
| `scripts/atlas-test/compare-agents.ts` | Atlas vs GPT comparison |
| `scripts/atlas-test/analyze-results.ts` | Generate analysis reports |
| `test-data/conversations.jsonl` | 779 production conversations |
| `test-data/custom-results.jsonl` | Custom test results |

---

## Appendix: All Failed Tests

### Failed Test #41 (intra_city)
- **Input:** `esenyurt kucukcekmece`
- **Expected:** search OR intra_city
- **Actual:** other
- **Response:** Shows Istanbul intra-city jobs (CORRECT behavior, wrong intent)

### Failed Test #42 (intra_city)
- **Input:** `kadikoy umraniye`
- **Expected:** search OR intra_city
- **Actual:** other
- **Response:** Shows Istanbul intra-city jobs (CORRECT behavior, wrong intent)

### Failed Test #44 (intra_city)
- **Input:** `bagcilar basaksehir`
- **Expected:** search OR intra_city
- **Actual:** other
- **Response:** Shows Istanbul intra-city jobs (CORRECT behavior, wrong intent)

### Failed Test #61 (slang)
- **Input:** `13 60 ile cikiyorum istanbul`
- **Expected:** search OR vehicle_info
- **Actual:** intra_city
- **Response:** Shows Istanbul outbound jobs (acceptable)

### Failed Test #74 (intent)
- **Input:** `ucretli mi`
- **Expected:** pricing
- **Actual:** other
- **Response:** "bu benim alanım değil abi..."

### Failed Test #75 (intent)
- **Input:** `yardim`
- **Expected:** help
- **Actual:** other
- **Response:** "sadece yük işine bakıyorum..."

### Failed Test #80 (intent)
- **Input:** `tesekkurler`
- **Expected:** thanks
- **Actual:** unknown
- **Response:** "rica ederim abi" (CORRECT response, wrong intent)

### Failed Test #91-95 (context)
- **Inputs:** `evet`, `tamam`, `olur`, `hayir`, `istemiyorum`
- **Expected:** confirmation/negation
- **Actual:** other
- **Response:** Confused responses (no context)

### Failed Test #97-100 (context)
- **Inputs:** `gorusuruz`, `sagol`, `bb`, `eyvallah`
- **Expected:** goodbye/thanks
- **Actual:** unknown
- **Response:** Correct farewell/thanks (CORRECT response, wrong intent)

---

**Report Generated:** 2026-01-25
**Tests Run By:** Claude Code automated testing

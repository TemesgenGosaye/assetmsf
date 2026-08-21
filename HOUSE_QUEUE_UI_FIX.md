# HOUSE QUEUE REVIEW - UI CLARIFICATION FIX

## Problem

The House Queue Review page was showing:
- "No Vacant Houses" 
- "No houses of type D available"

While there were actually vacant houses existing in the house tables, but of different types (A, B, C, etc.).

## Root Cause

This is **CORRECT BEHAVIOR** per the strict eligibility rules. The system is working as designed:

1. Applicant has `eligible_house_category = "D"` (based on their job grade)
2. The system filters to show ONLY houses of type "D" (line 331-335 in HouseQueueReview.tsx)
3. If no D houses are available, it correctly shows "No houses of type D available"
4. Houses of other types (A, B, C, etc.) are **intentionally hidden** because the applicant is NOT eligible for them

The confusion was that the UI didn't clearly explain WHY only certain house types were being shown.

## Solution

Updated the UI to make the strict eligibility enforcement clear:

### Change 1: Updated "No Vacant Houses" Message (Line 958-962)

**Before:**
```tsx
<p className="text-xs font-bold text-foreground">No Vacant Houses</p>
<p className="text-[11px] text-muted-foreground max-w-[240px]">
  No houses of type <strong>{detail.eligible_house_category || "\u2014"}</strong> available.
</p>
```

**After:**
```tsx
<p className="text-xs font-bold text-foreground">No Eligible Houses Available</p>
<p className="text-[11px] text-muted-foreground max-w-[240px]">
  No houses of type <strong>{detail.eligible_house_category || "\u2014"}</strong> are currently available.
  <br />
  <span className="text-[10px]">(Strict eligibility: Grade {detail.job_grade || "\u2014"} → {detail.eligible_house_category || "\u2014"} only)</span>
</p>
```

### Change 2: Updated "House Types" Field (Line 629)

**Before:**
```tsx
<FieldCell label="House Types">Staff, A, B, C, D, E</FieldCell>
```

**After:**
```tsx
<FieldCell label="House Types">{detail.eligible_house_category ? detail.eligible_house_category : "Not Eligible"}</FieldCell>
```

### Change 3: Updated "Available Houses" Field (Line 631)

**Before:**
```tsx
<FieldCell label="Available Houses">{sortedHouses.length} vacant</FieldCell>
```

**After:**
```tsx
<FieldCell label="Available Houses">{sortedHouses.length} {detail.eligible_house_category ? `of type ${detail.eligible_house_category}` : ""} vacant</FieldCell>
```

### Change 4: Updated Housing Options Subtitle (Line 838)

**Before:**
```tsx
<TableSection theme={THEMES.housing} title="Housing Options" subtitle="Available houses ranked by match score" icon={<Building2 className="h-3 w-3" />} cols={6}>
```

**After:**
```tsx
<TableSection theme={THEMES.housing} title="Housing Options" subtitle={detail.eligible_house_category ? `Available ${detail.eligible_house_category} houses ranked by match score` : "Not eligible for any house category"} icon={<Building2 className="h-3 w-3" />} cols={6}>
```

## Result

Now when a user sees "No Eligible Houses Available", they understand:
1. **WHY** no houses are shown (strict eligibility based on job grade)
2. **WHAT** their eligible category is (e.g., "Grade 14 → B only")
3. That houses of other types exist but are **intentionally excluded** due to eligibility rules

## Example Scenarios

### Scenario 1: Grade 14 Applicant, No B Houses Available
```
Housing Options: Available B houses ranked by match score
House Types: B
Available Houses: 0 of type B vacant

[No Eligible Houses Available]
No houses of type B are currently available.
(Strict eligibility: Grade 14 → B only)
```

### Scenario 2: Grade 14 Applicant, B Houses Available
```
Housing Options: Available B houses ranked by match score
House Types: B
Available Houses: 3 of type B vacant

[Shows 3 B houses in the table]
```

### Scenario 3: Invalid Grade
```
Housing Options: Not eligible for any house category
House Types: Not Eligible
Available Houses: 0 vacant

[No Eligible Houses Available]
No houses of type  available.
(Strict eligibility: Grade  →  only)
```

## Compliance with Strict Eligibility Rules

✅ **All changes maintain full compliance** with the strict eligibility requirements:
- Only houses matching the applicant's eligible category are shown
- No cross-category recommendations are made
- The system continues to enforce: Grade → Category → Filter → Rank → Recommend
- Users cannot bypass eligibility by seeing other house types

The UI now **clearly communicates** the strict eligibility enforcement rather than hiding it.

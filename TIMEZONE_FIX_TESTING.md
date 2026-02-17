# Manual Testing Guide - Timezone Fix Verification

## Bug Description
- **Issue**: At 10 PM UTC-3 (Brazil timezone), users couldn't schedule for the same day
- **Cause**: `getTodayDate()` used UTC conversion, making "today" appear as "tomorrow"
- **Fix**: Use local timezone dates instead of UTC conversion

## Test Scenarios

### 1. Primary Bug Scenario
**When**: 10 PM local time (UTC-3)
**Action**: Try to schedule for 3 PM same day
**Expected**: Should work without errors

### 2. Timezone Boundary Tests

#### Test at Different Hours:
- **9 AM**: Should work normally
- **3 PM**: Should work normally  
- **9 PM**: Should work (was failing before)
- **10 PM**: Should work (exact bug scenario)
- **11:59 PM**: Should work (was failing before)

#### Test at Midnight:
- **12:00 AM**: Should only allow scheduling for "today" (new day)

### 3. Manual Browser Testing

#### Setup:
1. Start the application: `npm run dev`
2. Navigate to `/schedule`
3. Select "Amistoso" match type

#### Test Steps:
1. **Check date input minimum**:
   - Inspect the date input element
   - Verify `min` attribute shows today's date in local timezone
   - Should be `YYYY-MM-DD` format for current local date

2. **Try selecting today's date**:
   - Should be selectable without validation errors
   - Should not show "Select date 02/17" type errors

3. **Try selecting yesterday**:
   - Should be prevented by browser validation
   - Date input should not accept past dates

#### Browser Console Test:
```javascript
// Test the date utility functions
import { getLocalDateString } from '/src/utils/dateUtils.js'

// Should return today in local timezone
console.log('Today:', getLocalDateString())

// Should not change based on time of day
console.log('Same at any hour:', getLocalDateString())
```

### 4. Automated Verification

#### Run the verification script:
```bash
node verify-timezone-fix.mjs
```

**Expected output**:
- ✅ Bug fixed: YES
- ✅ User can now schedule at night: YES
- All timezone boundary tests should pass

### 5. Edge Case Testing

#### Month/Year Boundaries:
- Test at end of month (e.g., Feb 28 at 11 PM)
- Test at end of year (e.g., Dec 31 at 11 PM)
- Should handle date rollovers correctly

#### Different Timezones:
- Test with system timezone set to UTC-3
- Test with other timezones if needed
- Function should work with any local timezone

## Expected Results

### Before Fix:
- ❌ At 10 PM UTC-3: min date was "2026-02-17"
- ❌ Couldn't schedule for same day after 9 PM
- ❌ Error: "Select date 02/17" when trying to schedule for 02/16

### After Fix:
- ✅ At 10 PM UTC-3: min date is "2026-02-16"
- ✅ Can schedule for same day at any hour
- ✅ No timezone conversion errors
- ✅ Works correctly for Brazilian users (UTC-3)

## Files Changed

1. **Created**: `src/utils/dateUtils.js`
   - `getLocalDateString()` - Returns local date without UTC conversion
   - `getTomorrowDateString()` - Returns tomorrow in local timezone
   - `isToday()`, `isPastDate()` - Helper functions
   - `formatDateForDisplay()` - Brazilian date format

2. **Modified**: `src/components/ScheduleForm.jsx`
   - Replaced `getTodayDate()` with `getLocalDateString()`
   - Imported timezone-aware utilities
   - Removed UTC conversion logic

## Verification Checklist

- [ ] Date input shows correct minimum date at night
- [ ] Can schedule for same day at 10 PM local time
- [ ] No "select tomorrow" errors when scheduling for today
- [ ] Works across month/year boundaries
- [ ] Browser validation prevents actual past dates
- [ ] Consistent behavior across page reloads

## Notes

- Fix is timezone-agnostic (works in any timezone)
- Maintains existing functionality for other times
- No breaking changes to existing schedules
- Backend date handling remains unchanged
# FlowTask Web Version - Code Audit Report

**Date:** 2025-11-23
**Audited Directory:** `/Users/keelandimick/VS Code Apps/FlowTask`
**Type:** React PWA (Progressive Web App) for iOS Safari

---

## ✅ **Good News First**

**No Legacy Code Found** - The codebase is modern and well-structured using React 19, TypeScript, and current best practices. No outdated patterns detected.

---

## 🔴 **Critical Issues**

### 1. **Security Vulnerability: Exposed OpenAI API Key**
**Location:** `src/lib/ai.tsx:5-6`

The OpenAI API key is exposed in the browser with `dangerouslyAllowBrowser: true`. This is a security risk as the key is visible in client-side code.

```typescript
const openai = new OpenAI({
  apiKey: process.env.REACT_APP_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // ⚠️ Security risk
});
```

**Impact:** API key can be extracted by anyone using your app
**Recommendation:** Move all AI processing to the edge function (like quick-add)
**Status:** User says "don't worry about this" - noted for later

---

## 🟡 **Major Issues - Duplicate Code**

### 2. **Date/Time Parsing Logic - Duplicated in 3 Places**

This complex logic is copy-pasted across:
1. `src/components/TaskModal.tsx:85-150`
2. `src/components/Notes.tsx:196-323`
3. `supabase/functions/quick-add/index.ts:209-297`

**Problems:**
- Same recurring pattern regex repeated
- Same time extraction logic repeated
- Same number word expansion logic repeated
- Inconsistencies will emerge when one is updated but not others

**Recommendation:** Extract to shared utility function in `src/utils/dateUtils.ts`
**Status:** User agrees - implement recommendation

---

### 3. **Day Abbreviation Expansion - Duplicated in 3 Places**

The day name expansion map appears in:
1. `src/components/TaskModal.tsx:273-289`
2. `src/components/TaskCard.tsx:244-259`
3. `src/components/Notes.tsx:129-145`

**Code:**
```typescript
const dayMap: Record<string, string> = {
  'mon': 'Monday', 'monday': 'Monday',
  'tue': 'Tuesday', 'tuesday': 'Tuesday',
  // ... etc
};
```

**Recommendation:** Move to `src/utils/constants.ts` as a shared constant
**Status:** User agrees - implement recommendation

---

### 4. **AI Processing Prompt - Duplicated in 2 Places**

The exact same AI prompt for spell correction appears in:
1. `src/lib/ai.tsx:28-45` (client-side)
2. `supabase/functions/quick-add/index.ts:128-144` (edge function)

**Recommendation:** Create a shared prompt template
**Status:** User agrees - implement recommendation

---

### 5. **Hold Note Detection - Duplicated in 2 Places**

The logic for detecting ON HOLD/OFF HOLD notes appears in:
1. `src/components/TaskCard.tsx:33-46`
2. `src/components/Notes.tsx:29-48`

**Recommendation:** Extract to shared utility function
**Status:** User agrees but mentions Notes.tsx will be removed/redone anyway, so only extract from TaskCard if needed

---

## 🟠 **Code Quality Issues**

### 6. **Unused Code: constants.ts File**

**Location:** `src/utils/constants.ts`

This entire file (57 lines) appears to be **completely unused**. No imports found anywhere in the codebase.

**Contents:**
- ANIMATION_DURATION
- LAYOUT constants
- COLORS (including priority colors, list palette)
- STYLES (button, modal, card styles)
- DEBOUNCE_DELAY

**Recommendation:** Delete if confirmed unused
**Status:** User requests to make absolutely sure it's unused, then delete completely

---

### 7. **Notes.tsx Component is Too Large**

**Location:** `src/components/Notes.tsx` (816 lines)

This component handles too many responsibilities:
- Title editing with date/recurrence parsing
- Note CRUD operations
- ON HOLD status management
- Real-time date preview
- Type conversion (task ↔ reminder ↔ recurring)

**Recommendation:** Break into smaller sub-components
**Status:** User says entire file will be removed/redone - no action needed

---

### 8. **Missing useEffect Dependencies**

**Location:** `src/App.tsx:128`

```typescript
useEffect(() => {
  // ... arrow key navigation logic
}, [selectedItemId, setSelectedItem, items, currentView, displayMode]);
```

Missing dependencies: `getVisuallyOrderedItems`, `setHighlightedItem`

**Impact:** Could cause stale closure bugs
**Status:** Needs review

---

### 9. **Magic Numbers Throughout Codebase**

Examples:
- `src/store/useStoreWithAuth.ts:40` - `15000` (15 seconds)
- `src/store/useStoreWithAuth.ts:47` - `30000` (30 seconds polling)
- `src/store/useStore.ts:191` - `5000` (5 second timeout)
- `src/components/Notes.tsx:386` - `50` (navigation delay)
- `src/components/Notes.tsx:388` - `100` (close delay)

**Recommendation:** Use constants from constants.ts or define at module level
**Status:** Pending

---

## 🔵 **Confusing/Complex Code**

### 10. **Complex Collision Detection Logic**

**Location:** `src/App.tsx:137-159`

The custom collision detection function handles multiple column types (task/reminder/recurring) with complex filtering logic. This would benefit from inline comments explaining the prioritization.

**Status:** Add documentation

---

### 11. **itemsInFlight and recentlyUpdatedItems Logic**

**Location:** `src/store/useStore.ts:169-199`

The optimistic update system for shared lists uses:
- `itemsInFlight` Set to track pending updates
- `recentlyUpdatedItems` Set for merge conflicts
- Timeout-based cleanup with race condition handling

**Problem:** Complex state management that's hard to debug
**Status:** Needs review

---

### 12. **Parallel Recurrence Pattern Lists**

The recurring pattern detection uses different arrays in different places:
- TaskModal has 9 patterns
- quick-add edge function has 9 patterns
- Notes.tsx has similar patterns inline

These should be consolidated.

**Status:** Will be addressed when consolidating date/time parsing logic

---

## 🤔 **Questions for Further Investigation**

### 13. **Why Two Different Update Strategies?**

**Location:** `src/store/useStore.ts:169-217`

The code uses:
- **Optimistic updates** for personal lists (immediate UI update)
- **Loading states** for shared lists (wait for realtime confirmation)

**Questions:**
- Is this intentional for UX reasons?
- Could this cause confusion when switching between personal and shared lists?
- Have you experienced any bugs from this dual approach?

---

### 14. **Polling vs. Realtime Subscriptions**

**Location:** `src/store/useStoreWithAuth.ts:34-47`

The app uses:
- **30-second polling** for personal lists
- **Realtime subscriptions** for shared lists

**Questions:**
- Why not use realtime for everything?
- Is this a cost optimization?
- What happens if polling and realtime both trigger at the same time?

---

### 15. **Deleted SIRI_SETUP.md File**

**Location:** Git status shows `D SIRI_SETUP.md`

You deleted the Siri setup documentation but the Siri integration edge function still exists and works.

**Questions:**
- Was this intentional?
- Do users still need setup instructions?
- Should there be in-app setup guidance instead?

---

### 16. **Position Field Usage**

**Location:** `src/lib/database.ts:158,315`

There's a `position` field that's cast with `(dbItem as any).position`:

```typescript
position: (dbItem as any).position || undefined,
```

**Questions:**
- Is this field actually in the database schema?
- Why the `any` cast?
- Is manual reordering planned but not implemented?

---

## 📊 **Summary Statistics**

- **Total components audited:** 8
- **Total utilities audited:** 4
- **Total store files audited:** 3
- **Lines of duplicate code:** ~400+ lines
- **Unused files:** 1 (constants.ts)
- **Security issues:** 1 (noted, not critical per user)
- **Major code duplication issues:** 5
- **Code quality issues:** 4
- **Complex/confusing sections:** 3

---

## 🎯 **Recommended Priority Order**

1. ~~**[P0 - Immediate]** Fix OpenAI API key exposure~~ (User: don't worry about this)
2. **[P1 - High]** Consolidate date/time parsing logic
3. **[P1 - High]** Consolidate AI prompt duplication
4. **[P2 - Medium]** Extract day abbreviation map
5. **[P2 - Medium]** Extract hold note detection
6. **[P2 - Medium]** Fix useEffect dependencies
7. **[P3 - Low]** Use constants instead of magic numbers
8. **[P3 - Low]** Clean up unused constants.ts or start using it
9. ~~**[P3 - Low]** Break down Notes.tsx component~~ (Will be removed/redone)
10. **[P3 - Low]** Add comments to complex collision detection

---

## 📝 **Action Items for Later**

These issues were identified but deferred:
- Security: OpenAI API key in browser (user acknowledged)
- Notes.tsx component size (will be redone)
- Constants file usage decision
- Magic numbers standardization

---

## 🏗️ **Architecture Overview**

**Application Type:** Progressive Web App (PWA)
**Frontend:** React 19 + TypeScript + Tailwind CSS
**State Management:** Zustand
**Backend:** Supabase (PostgreSQL + Auth + Realtime)
**AI Integration:** OpenAI GPT-4o-mini
**Special Features:** Siri Shortcuts via Supabase Edge Function

**iOS Integration Method:**
The app is optimized as a web app that users can add to their iOS home screen via Safari's "Add to Home Screen" feature, making it feel like a native app while remaining entirely web-based.

---

*End of Audit Report*

# System Notifications Fix — Bugfix Design

## Overview

Two distinct but related bugs make the SAMS notification bell unreliable:

**Bug A — Missing notification calls on four pages.** Assets, Approvals, Tickets, and Employees all perform CRUD operations successfully but never invoke `trackActivity` (or `addNotification`) from `@/services/notifications`. The notification service already exports everything needed; the pages simply don't import or call it.

**Bug B — No realtime push in Header and TopNavBar.** Both notification-bell components fetch the initial list on mount and re-fetch when the dropdown opens, but neither subscribes to Supabase realtime changes on the `notifications` table. This means notifications created by Bug A's fix (or by already-working pages) don't appear until the user manually opens the bell.

The fix strategy is:
1. Import `trackActivity` into each missing page and call it after every successful CRUD operation.
2. Add a `useEffect` subscription in `Header` and `TopNavBar` that listens for `INSERT` events on `notifications` filtered to `user_id = currentUserId`, then re-fetches and updates state (and plays the notification sound).

## Glossary

- **Bug_Condition A (C_A)**: A successful CRUD operation on Assets, Approvals, Tickets, or Employees that completes without a corresponding `trackActivity` / `addNotification` call.
- **Bug_Condition B (C_B)**: A `notifications` row is inserted in Supabase for the current user, but the bell component has no realtime subscription to detect it.
- **trackActivity**: The function exported from `@/services/notifications` that creates a structured notification entry for a CRUD event.
- **addNotification**: Lower-level function from `@/services/notifications` used directly for domain-specific messages (reports, QR codes).
- **Realtime subscription**: A Supabase channel that calls `.on("postgres_changes", ...)` to receive database-level INSERT/UPDATE/DELETE events.
- **F**: The original (unfixed) function/component — code as it exists before the fix.
- **F'**: The fixed function/component — code after the fix is applied.
- **Preservation**: Behaviors that must remain identical between F and F' for all non-buggy inputs.

## Bug Details

### Bug Condition

**Bug A** manifests on every successful CRUD operation within Assets, Approvals, Tickets, and Employees — none of these pages import or call the notification service.

**Bug B** manifests on every page load in non-demo mode with Supabase configured — neither `Header` nor `TopNavBar` subscribes to realtime notifications.

**Formal Specification:**

```
FUNCTION isBugConditionA(operation)
  INPUT: operation of type CRUDEvent
    { page: 'Assets' | 'Approvals' | 'Tickets' | 'Employees'
    , action: 'create' | 'update' | 'delete' | 'forward' | 'approve' | 'reject' | 'close'
    , succeeded: boolean }
  OUTPUT: boolean

  RETURN operation.page IN ['Assets', 'Approvals', 'Tickets', 'Employees']
         AND operation.succeeded = true
         AND no trackActivity call was made during this operation
END FUNCTION

FUNCTION isBugConditionB(component)
  INPUT: component of type NotificationBell
    { name: 'Header' | 'TopNavBar'
    , hasRealtimeSubscription: boolean }
  OUTPUT: boolean

  RETURN component.name IN ['Header', 'TopNavBar']
         AND component.hasRealtimeSubscription = false
         AND isDemoMode() = false
         AND hasSupabaseEnv = true
END FUNCTION
```

### Examples

- **Bug A**: User creates an asset on Assets page → toast "Asset created" appears, `logActivity` is called, `trackActivity` is NOT called → notification bell count stays at 0.
- **Bug A**: Manager forwards an approval on Approvals page → approval row updated in DB, no notification recorded anywhere.
- **Bug A**: User creates a new ticket → ticket saved, no notification entry written.
- **Bug A**: Admin deletes an employee → employee deleted, `logActivity("employee_deleted", ...)` called, `trackActivity` NOT called.
- **Bug B**: Another user's action triggers `trackActivity` for the current user → new row inserted in `notifications` → Header bell badge stays stale; user must manually open dropdown to see it.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Users page: `trackActivity` calls for create/update/delete must remain untouched.
- QR Codes page: `addNotification` calls must remain untouched.
- Reports page: `addNotification` call must remain untouched.
- Profile/Settings pages: `trackActivity` calls must remain untouched.
- Manual open of notification dropdown: must still mark-all-read and re-fetch, as today.
- Clear-all notifications: must still delete all and empty the list, as today.
- Demo mode: must continue to use seeded demo notifications; realtime subscription must not activate in demo mode.
- Existing error handling and loading states on all modified pages must remain intact.

**Scope:**
All inputs that do NOT satisfy `isBugConditionA` or `isBugConditionB` — i.e. all non-CRUD interactions on the affected pages, and all components other than Header/TopNavBar — should be completely unaffected by the fix.

## Hypothesized Root Cause

**Bug A:**
1. **Missing import**: Assets, Approvals, Tickets, and Employees pages never imported `trackActivity` from `@/services/notifications`. The developers used `logActivity` (from `@/services/activity`) instead, which writes to an activity log but is not the notification service.
2. **Inconsistent pattern**: The Users, Reports, and QR Codes pages show the correct pattern but it was not applied when the other four pages were built or extended.

**Bug B:**
1. **Static fetch only**: Both `Header` and `TopNavBar` load notifications in a `useEffect([], [])` and re-fetch on dropdown open. There is no `supabase.channel()` subscription that would push new rows.
2. **Approvals and Tickets pages already subscribe**: Both `Approvals.tsx` and `Tickets.tsx` already have working realtime subscriptions on their respective tables. The same pattern was never applied to the notification bell components.

## Correctness Properties

Property 1: Bug Condition A — CRUD operations produce notification entries

_For any_ successful CRUD operation on the Assets, Approvals, Tickets, or Employees pages (where `isBugConditionA` returns true), the fixed page component F' SHALL call `trackActivity` with the correct `EntityType` and `CRUDOperation` after the operation, resulting in a new row in the `notifications` table (or localStorage when Supabase is unavailable).

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Bug Condition B — Realtime push updates the notification bell

_For any_ INSERT event on the `notifications` table where `user_id` equals the current user's id (where `isBugConditionB` returns true), the fixed `Header` and `TopNavBar` components F' SHALL receive the event via their realtime subscription, re-fetch the notification list, update the unread badge count, and play the notification sound — without requiring the user to open the dropdown.

**Validates: Requirements 2.5, 2.6**

Property 3: Preservation — Existing notification calls and bell behavior unchanged

_For any_ operation that does NOT satisfy `isBugConditionA` or `isBugConditionB` (pages already calling the notification service, demo mode behavior, manual dropdown open/close, clear-all), the fixed code F' SHALL produce exactly the same behavior as the original code F.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

#### File: `src/pages/Assets.tsx`

**Add import:**
```ts
import { trackActivity } from "@/services/notifications";
```

**Specific Changes:**
1. After `createAsset` succeeds → call `trackActivity('asset', 'create', { entityName: newAsset.name, entityId: newAsset.id })`.
2. After `updateAsset` succeeds → call `trackActivity('asset', 'update', { entityName: asset.name, entityId: asset.id })`.
3. After `deleteAsset` succeeds → call `trackActivity('asset', 'delete', { entityName: asset.name, entityId: asset.id })`.
4. After bulk delete succeeds → call `trackActivity('asset', 'delete', { entityId: `${count} assets`, changes: ['bulk delete'] })`.
5. After bulk property assignment succeeds → call `trackActivity('asset', 'update', { changes: [`bulk property assign: ${count} assets`] })`.
6. After bulk condition update succeeds → call `trackActivity('asset', 'update', { changes: [`bulk condition update: ${count} assets`] })`.

#### File: `src/pages/Approvals.tsx`

**Add import:**
```ts
import { trackActivity } from "@/services/notifications";
```

**Specific Changes:**
1. In `onForward` after `forwardApprovalToAdmin` succeeds → call `trackActivity('approval', 'update', { entityId: id, changes: ['forwarded to admin'] })`.
2. In `onDecision` after `decideApprovalFinal` succeeds → call `trackActivity('approval', 'update', { entityId: id, changes: [d] })`.
3. In `runBulkAction` after each successful operation → call `trackActivity('approval', 'update', { changes: [`bulk ${stage} ${action}: ${successCount}`] })`.

#### File: `src/pages/Tickets.tsx`

**Add import:**
```ts
import { trackActivity } from "@/services/notifications";
```

**Specific Changes:**
1. In `add` after `createTicket` succeeds → call `trackActivity('ticket', 'create', { entityId: t.id, entityName: t.title })`.
2. In `setStatus` after `updateTicket` succeeds → call `trackActivity('ticket', 'update', { entityId: id, changes: [status] })`.
3. In `confirmClose` after `updateTicket` succeeds → call `trackActivity('ticket', 'update', { entityId: closingId, changes: ['closed'] })`.

#### File: `src/pages/Employees.tsx`

**Add import:**
```ts
import { trackActivity } from "@/services/notifications";
```

**Specific Changes:**
1. In `handleSubmit` after `updateEmployee` succeeds → call `trackActivity('user', 'update', { entityName: updated.full_name, entityId: updated.employee_id })`.
2. In `handleSubmit` after `createEmployee` succeeds → call `trackActivity('user', 'create', { entityName: created.full_name, entityId: created.employee_id })`.
3. In `handleDelete` after `deleteEmployee` succeeds → call `trackActivity('user', 'delete', { entityName: deleteTarget.full_name, entityId: deleteTarget.employee_id })`.

#### File: `src/components/layout/Header.tsx`

**Specific Changes — add a realtime subscription `useEffect`:**
```ts
useEffect(() => {
  if (isDemoMode() || !hasSupabaseEnv) return;
  const uid = authUser?.id;
  if (!uid) return;
  const channel = supabase
    .channel(`header_notifications_${uid}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
      async () => {
        const data = await listNotifications(50);
        setNotifications(data);
        try { playNotificationSound(); } catch {}
      }
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [authUser?.id]);
```

Add `playNotificationSound` import from `@/lib/sound`.

#### File: `src/components/layout/TopNavBar.tsx`

**Specific Changes — add a realtime subscription `useEffect`:**
Same pattern as Header, keyed on `getCurrentUserId()` resolved at mount, with channel name `topnav_notifications_${uid}`.

Add `playNotificationSound` import from `@/lib/sound` and `getCurrentUserId` is already imported.

## Testing Strategy

### Validation Approach

Follow the four-phase exploratory approach: Explore (write tests that fail on unfixed code to confirm the bug), Preserve (write tests that pass on unfixed code to capture baseline), Implement (apply the fix), Validate (both test suites pass).

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples confirming Bug A and Bug B exist BEFORE implementing the fix.

**Test Plan**: Write tests that mock the notification service and assert `trackActivity` is called after CRUD success handlers; assert it is NOT called before the fix. For Bug B, write a test that mounts Header/TopNavBar and asserts a `supabase.channel()` subscription is established; confirm it is not established before the fix.

**Test Cases:**
1. **Assets create — no notification** (Bug A): Trigger `handleAddAsset` with valid data → assert `trackActivity` was NOT called (will fail on unfixed code, confirming Bug A). _(Expected fail before fix)_
2. **Approvals forward — no notification** (Bug A): Trigger `onForward` → assert `trackActivity` was NOT called. _(Expected fail before fix)_
3. **Tickets create — no notification** (Bug A): Trigger `add()` in Tickets → assert `trackActivity` was NOT called. _(Expected fail before fix)_
4. **Employees create — no notification** (Bug A): Trigger `handleSubmit` for a new employee → assert `trackActivity` was NOT called. _(Expected fail before fix)_
5. **Header — no realtime subscription** (Bug B): Mount `Header`, confirm no `supabase.channel` call was made. _(Expected fail before fix)_
6. **TopNavBar — no realtime subscription** (Bug B): Mount `TopNavBar`, confirm no `supabase.channel` call was made. _(Expected fail before fix)_

**Expected Counterexamples:**
- `trackActivity` mock is never invoked for any of the four pages.
- No `supabase.channel` call is made by either bell component.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed components produce the expected behavior.

**Pseudocode:**
```
FOR ALL operation WHERE isBugConditionA(operation) DO
  result := fixedPageHandler(operation)
  ASSERT trackActivity_was_called_with_correct_args(result)
END FOR

FOR ALL component WHERE isBugConditionB(component) DO
  mount(component_fixed)
  ASSERT supabase_channel_subscribed_for_current_user(component_fixed)
  simulate INSERT on notifications table
  ASSERT notificationList_updated AND unreadBadge_updated
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, fixed code behaves identically to original code.

**Pseudocode:**
```
FOR ALL operation WHERE NOT isBugConditionA(operation) DO
  ASSERT F(operation) = F'(operation)
END FOR

FOR ALL component WHERE NOT isBugConditionB(component) DO
  ASSERT F(component) = F'(component)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because it generates broad input coverage automatically. Observe current behavior on unfixed code for existing-working pages first, then write property tests asserting that behavior.

**Test Cases:**
1. **Users page — trackActivity still called**: Confirm `trackActivity` is still invoked for create/update/delete on Users page after the fix.
2. **QR Codes page — addNotification still called**: Confirm `addNotification` is still invoked for QR generation after the fix.
3. **Manual dropdown open**: Mount fixed Header, open dropdown → assert `markAllRead` and `listNotifications` are still called.
4. **Demo mode — no subscription**: In demo mode, mount fixed Header → assert no `supabase.channel` is created.
5. **Notification list limit**: Fixed Header must still cap the displayed list at 12 items.

### Unit Tests

- Test each of the six CRUD handlers (Assets: create/update/delete, Approvals: forward/decide, Tickets: create/setStatus/close, Employees: create/update/delete) to confirm `trackActivity` is called with correct `EntityType` and `CRUDOperation`.
- Test bulk operations (bulk delete, bulk property assign, bulk condition update on Assets) to confirm a notification is recorded.
- Test Header and TopNavBar subscription lifecycle: subscribe on mount, unsubscribe on unmount.

### Property-Based Tests

- Generate random sequences of Asset CRUD operations; for every successful one, assert a notification entry was created.
- Generate random sequences of Approval decisions; assert each produces a notification.
- Generate random Ticket state transitions; assert each produces a notification.
- For preservation: generate random non-CRUD interactions on Assets/Tickets/Approvals/Employees (e.g., filter changes, sort changes, search input) and assert no `trackActivity` call is made.

### Integration Tests

- Full flow: create an asset → open the notification bell → assert the new notification appears and unread count incremented.
- Realtime flow (Supabase integration): insert a notification directly into the DB → assert Header bell badge updates without user interaction within ~1 second.
- Demo mode smoke test: enter demo mode, perform any CRUD, confirm no real Supabase calls are made.

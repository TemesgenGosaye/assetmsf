# Implementation Plan

- [ ] 1. Write bug condition exploration tests (Bug A — missing trackActivity calls)
  - **Property 1: Bug Condition** — CRUD Operations Produce No Notifications
  - **IMPORTANT**: Write these tests BEFORE implementing any fix
  - **CRITICAL**: These tests MUST FAIL on unfixed code — failure confirms Bug A exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **GOAL**: Surface counterexamples proving that trackActivity is never called on the four affected pages
  - **Scoped PBT Approach**: Scope each property to one concrete handler per page for reproducibility
  - Mock `trackActivity` from `@/services/notifications` using `vi.spyOn` (or jest mock)
  - Test 1 — Assets create: call `handleAddAsset` with valid asset data → assert `trackActivity` was NOT called (will fail on unfixed code, confirming bug)
  - Test 2 — Approvals forward: call `onForward` with a valid id → assert `trackActivity` was NOT called (will fail on unfixed code)
  - Test 3 — Tickets create: call `add()` with valid title/description/propertyId → assert `trackActivity` was NOT called (will fail on unfixed code)
  - Test 4 — Employees create: call `handleSubmit` for new employee → assert `trackActivity` was NOT called (will fail on unfixed code)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: All four assertions fail (confirms Bug A in each page)
  - Document counterexamples found, e.g. "Assets.handleAddAsset — trackActivity never invoked; logActivity called instead"
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 2. Write bug condition exploration tests (Bug B — no realtime subscription)
  - **Property 1: Bug Condition** — Notification Bell Has No Realtime Subscription
  - **IMPORTANT**: Write these tests BEFORE implementing any fix
  - **CRITICAL**: These tests MUST FAIL on unfixed code — failure confirms Bug B exists
  - **GOAL**: Surface counterexamples proving Header and TopNavBar never call `supabase.channel()`
  - Mock `supabase` from `@/lib/supabaseClient` and spy on `.channel()`
  - Test 1 — Header: mount `Header` with a logged-in non-demo user → assert `supabase.channel` was NOT called (will fail on unfixed code)
  - Test 2 — TopNavBar: mount `TopNavBar` with a logged-in non-demo user → assert `supabase.channel` was NOT called (will fail on unfixed code)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Both assertions fail (confirms Bug B in each component)
  - Document counterexamples found, e.g. "Header mounts without any supabase.channel() call; notification list only populated on mount via listNotifications()"
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.5, 1.6_

- [ ] 3. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** — Existing Notification Behavior Is Unchanged
  - **IMPORTANT**: Follow observation-first methodology — observe on UNFIXED code first
  - Observe: Users page `handleCreateUser` calls `trackActivity('user', 'create', ...)` ✓
  - Observe: QR Codes page calls `addNotification` after QR generation ✓
  - Observe: Header `onOpenChange` calls `markAllRead` then `listNotifications` when dropdown opens ✓
  - Observe: Header in demo mode does NOT call `supabase.channel` ✓
  - Write property-based test: for any sequence of non-CRUD interactions on Assets/Approvals/Tickets/Employees (filter changes, search, sort), assert `trackActivity` is never called
  - Write test: Users page create/update/delete → assert `trackActivity` is still called (must pass before and after fix)
  - Write test: Manual dropdown open on Header → assert `markAllRead` + `listNotifications` called
  - Write test: Demo mode mount of Header → assert NO `supabase.channel` call is made
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: ALL preservation tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [ ] 4. Fix for missing trackActivity calls on Assets, Approvals, Tickets, and Employees pages

  - [ ] 4.1 Add trackActivity calls to Assets page (src/pages/Assets.tsx)
    - Add `import { trackActivity } from "@/services/notifications";` to the imports
    - After `createAsset` succeeds: call `trackActivity('asset', 'create', { entityName: newAsset.name, entityId: newAsset.id })`
    - After `updateAsset` succeeds: call `trackActivity('asset', 'update', { entityName: asset.name, entityId: asset.id })`
    - After `deleteAsset` (single) succeeds: call `trackActivity('asset', 'delete', { entityName: asset.name, entityId: asset.id })`
    - After bulk delete succeeds: call `trackActivity('asset', 'delete', { entityId: \`${count} assets\`, changes: ['bulk delete'] })`
    - After bulk property assignment succeeds: call `trackActivity('asset', 'update', { changes: [\`bulk property assign: ${count} assets\`] })`
    - After bulk condition update succeeds: call `trackActivity('asset', 'update', { changes: [\`bulk condition update: ${count} assets\`] })`
    - _Bug_Condition: isBugConditionA(op) where op.page = 'Assets' AND op.succeeded = true_
    - _Expected_Behavior: trackActivity called with entity='asset' and correct operation_
    - _Preservation: logActivity calls must remain; no change to error handling or loading states_
    - _Requirements: 2.1, 3.1_

  - [ ] 4.2 Add trackActivity calls to Approvals page (src/pages/Approvals.tsx)
    - Add `import { trackActivity } from "@/services/notifications";` to the imports
    - In `onForward` after success: call `trackActivity('approval', 'update', { entityId: id, changes: ['forwarded to admin'] })`
    - In `onDecision` after success: call `trackActivity('approval', 'update', { entityId: id, changes: [d] })`
    - In `runBulkAction` after bulk success: call `trackActivity('approval', 'update', { changes: [\`bulk ${stage} ${action}: ${successCount}\`] })`
    - _Bug_Condition: isBugConditionA(op) where op.page = 'Approvals' AND op.succeeded = true_
    - _Expected_Behavior: trackActivity called with entity='approval' and correct operation_
    - _Preservation: existing supabase realtime subscription for the approvals table must remain untouched_
    - _Requirements: 2.2_

  - [ ] 4.3 Add trackActivity calls to Tickets page (src/pages/Tickets.tsx)
    - Add `import { trackActivity } from "@/services/notifications";` to the imports
    - In `add` after `createTicket` succeeds: call `trackActivity('ticket', 'create', { entityId: t.id, entityName: t.title })`
    - In `setStatus` after `updateTicket` succeeds: call `trackActivity('ticket', 'update', { entityId: id, changes: [status] })`
    - In `confirmClose` after `updateTicket` succeeds: call `trackActivity('ticket', 'update', { entityId: closingId, changes: ['closed'] })`
    - _Bug_Condition: isBugConditionA(op) where op.page = 'Tickets' AND op.succeeded = true_
    - _Expected_Behavior: trackActivity called with entity='ticket' and correct operation_
    - _Preservation: existing supabase realtime subscription for the tickets table must remain untouched_
    - _Requirements: 2.3_

  - [ ] 4.4 Add trackActivity calls to Employees page (src/pages/Employees.tsx)
    - Add `import { trackActivity } from "@/services/notifications";` to the imports
    - In `handleSubmit` branch for update after success: call `trackActivity('user', 'update', { entityName: updated.full_name, entityId: updated.employee_id })`
    - In `handleSubmit` branch for create after success: call `trackActivity('user', 'create', { entityName: created.full_name, entityId: created.employee_id })`
    - In `handleDelete` after success: call `trackActivity('user', 'delete', { entityName: deleteTarget.full_name, entityId: deleteTarget.employee_id })`
    - Note: keep the existing `logActivity` calls alongside the new `trackActivity` calls — do not remove them
    - _Bug_Condition: isBugConditionA(op) where op.page = 'Employees' AND op.succeeded = true_
    - _Expected_Behavior: trackActivity called with entity='user' and correct operation_
    - _Preservation: logActivity calls must remain in place_
    - _Requirements: 2.4_

  - [ ] 4.5 Verify bug condition exploration tests (Bug A) now pass
    - **Property 1: Expected Behavior** — CRUD Operations Now Produce Notifications
    - **IMPORTANT**: Re-run the SAME tests from tasks 1 — do NOT write new tests
    - The tests from task 1 encode the expected behavior: trackActivity called after each CRUD success
    - Run all four bug condition exploration tests from task 1
    - **EXPECTED OUTCOME**: All four tests PASS (confirms Bug A is fixed on all four pages)
    - _Requirements: Property 1 (Validates 2.1, 2.2, 2.3, 2.4)_

  - [ ] 4.6 Verify preservation tests still pass after Bug A fix
    - **Property 2: Preservation** — Existing Notification Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 3 — do NOT write new tests
    - Run all preservation property tests from task 3
    - **EXPECTED OUTCOME**: ALL preservation tests still PASS (no regressions)
    - _Requirements: Property 3 (Validates 3.1–3.7)_

- [ ] 5. Fix for missing realtime push subscriptions in Header and TopNavBar

  - [ ] 5.1 Add realtime subscription to Header (src/components/layout/Header.tsx)
    - Add `import { playNotificationSound } from "@/lib/sound";` (check if already imported)
    - Add a new `useEffect` that depends on `authUser?.id`
    - Guard: if `isDemoMode()` or `!hasSupabaseEnv` or no `authUser?.id`, return immediately (no subscription)
    - Create channel: `supabase.channel(\`header_notifications_${uid}\`)`
    - Subscribe to: `{ event: "INSERT", schema: "public", table: "notifications", filter: \`user_id=eq.${uid}\` }`
    - On event: call `listNotifications(50)` and `setNotifications(data)`, then `playNotificationSound()` (wrapped in try/catch)
    - Return cleanup: `supabase.removeChannel(channel)`
    - _Bug_Condition: isBugConditionB(component) where component.name = 'Header'_
    - _Expected_Behavior: supabase.channel subscribed; INSERT events update state and play sound_
    - _Preservation: existing onOpenChange, markAllRead, listNotifications, clearAllNotifications behavior unchanged_
    - _Requirements: 2.5, 3.5, 3.6, 3.7_

  - [ ] 5.2 Add realtime subscription to TopNavBar (src/components/layout/TopNavBar.tsx)
    - Add `import { playNotificationSound } from "@/lib/sound";`
    - Resolve the current user id at the start of the subscription effect using `getCurrentUserId()` (already imported)
    - Add a new `useEffect` with no dependencies (run once on mount, cleanup on unmount)
    - Guard: if `isDemoMode()` or `!hasSupabaseEnv` or no uid, return immediately
    - Create channel: `supabase.channel(\`topnav_notifications_${uid}\`)`
    - Subscribe to: `{ event: "INSERT", schema: "public", table: "notifications", filter: \`user_id=eq.${uid}\` }`
    - On event: call `listNotifications(50)` and `setNotifications(data)`, then `playNotificationSound()` (wrapped in try/catch)
    - Return cleanup: `supabase.removeChannel(channel)`
    - Add `import { hasSupabaseEnv, supabase } from "@/lib/supabaseClient";` if not already present
    - _Bug_Condition: isBugConditionB(component) where component.name = 'TopNavBar'_
    - _Expected_Behavior: supabase.channel subscribed; INSERT events update state and play sound_
    - _Preservation: existing notification fetch on mount and onOpenChange behavior unchanged; demo mode behavior unchanged_
    - _Requirements: 2.6, 3.5, 3.6, 3.7_

  - [ ] 5.3 Verify bug condition exploration tests (Bug B) now pass
    - **Property 1: Expected Behavior** — Notification Bell Has Realtime Subscription
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run both Bug B exploration tests (Header + TopNavBar) from task 2
    - **EXPECTED OUTCOME**: Both tests PASS (confirms Bug B is fixed in both components)
    - _Requirements: Property 2 (Validates 2.5, 2.6)_

  - [ ] 5.4 Verify preservation tests still pass after Bug B fix
    - **Property 2: Preservation** — Realtime Does Not Break Existing Bell Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 3 — do NOT write new tests
    - Pay particular attention to: demo-mode no-subscription test, manual dropdown test
    - **EXPECTED OUTCOME**: ALL preservation tests still PASS (no regressions)
    - _Requirements: Property 3 (Validates 3.5, 3.6, 3.7)_

- [ ] 6. Checkpoint — Ensure all tests pass
  - Run the full test suite and confirm zero failures
  - Manually smoke-test: create an asset → bell badge updates without opening dropdown
  - Manually smoke-test: forward an approval → bell updates
  - Manually smoke-test: create a ticket → bell updates
  - Manually smoke-test: open notification dropdown → notifications from all four fixed pages appear with correct titles and messages
  - Confirm demo mode is unaffected: no realtime calls, seeded notifications still display
  - Ask the user if any questions arise before marking complete

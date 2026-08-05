# Bugfix Requirements Document

## Introduction

The SAMS system notification bell is incomplete in two ways. First, four pages (Assets, Approvals, Tickets, and Employees) perform CRUD operations but never call `trackActivity` or `addNotification` from `@/services/notifications`, so those actions are invisible to the notification system. Second, the notification bell in both `Header.tsx` and `TopNavBar.tsx` has no Supabase realtime subscription on the `notifications` table, so the unread badge and notification list only update when the user manually opens the dropdown — new notifications are not pushed automatically.

The combined effect is that most system activity goes untracked in the bell, and even the activity that _is_ tracked (Users, Reports, QR Codes) does not surface to the user until they manually open the dropdown.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user creates, updates, deletes, bulk-deletes, bulk-assigns a property, or bulk-updates a condition on the Assets page THEN the system performs the operation and calls `logActivity` but makes zero calls to `trackActivity` or `addNotification`, so no notification entry is recorded.

1.2 WHEN a manager forwards, approves, or rejects an approval request on the Approvals page THEN the system updates the approval record but makes zero calls to `trackActivity` or `addNotification`, so no notification entry is recorded.

1.3 WHEN a user creates a ticket, updates a ticket's status, or closes a ticket on the Tickets page THEN the system saves the change but makes zero calls to `trackActivity` or `addNotification`, so no notification entry is recorded.

1.4 WHEN a user creates, updates, or deletes an employee record on the Employees page THEN the system saves the change and calls `logActivity` but makes zero calls to `trackActivity` or `addNotification`, so no notification entry is recorded.

1.5 WHEN a new notification row is inserted into the Supabase `notifications` table for the current user THEN the Header notification bell does not receive a realtime push; the unread badge and notification list remain stale until the user manually opens the dropdown.

1.6 WHEN a new notification row is inserted into the Supabase `notifications` table for the current user THEN the TopNavBar notification bell does not receive a realtime push; the unread badge and notification list remain stale until the user manually opens the dropdown.

### Expected Behavior (Correct)

2.1 WHEN a user creates, updates, deletes, bulk-deletes, bulk-assigns a property, or bulk-updates a condition on the Assets page THEN the system SHALL call `trackActivity` with entity type `'asset'` and the appropriate operation after each successful CRUD operation, recording a notification entry.

2.2 WHEN a manager forwards, approves, or rejects an approval request on the Approvals page THEN the system SHALL call `trackActivity` with entity type `'approval'` and the appropriate operation after each successful decision, recording a notification entry.

2.3 WHEN a user creates a ticket, updates a ticket's status, or closes a ticket on the Tickets page THEN the system SHALL call `trackActivity` with entity type `'ticket'` and the appropriate operation after each successful change, recording a notification entry.

2.4 WHEN a user creates, updates, or deletes an employee record on the Employees page THEN the system SHALL call `trackActivity` with entity type `'user'` and the appropriate operation after each successful CRUD operation, recording a notification entry.

2.5 WHEN a new notification row is inserted into the Supabase `notifications` table for the current user THEN the Header component SHALL receive a realtime push via a `supabase.channel(...).on("postgres_changes", ...)` subscription, immediately update the notification list and unread badge, and play the notification sound.

2.6 WHEN a new notification row is inserted into the Supabase `notifications` table for the current user THEN the TopNavBar component SHALL receive a realtime push via a `supabase.channel(...).on("postgres_changes", ...)` subscription, immediately update the notification list and unread badge, and play the notification sound.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user performs a CRUD operation on the Users page THEN the system SHALL CONTINUE TO call `trackActivity` as it does today, with no change to its existing notification behavior.

3.2 WHEN a user generates or prints a QR code on the QR Codes page THEN the system SHALL CONTINUE TO call `addNotification` as it does today, with no change to its existing notification behavior.

3.3 WHEN a user generates a report on the Reports page THEN the system SHALL CONTINUE TO call `addNotification` as it does today, with no change to its existing notification behavior.

3.4 WHEN a user updates their profile or settings THEN the system SHALL CONTINUE TO call `trackActivity` as it does today, with no change to its existing notification behavior.

3.5 WHEN a user manually opens the notification dropdown in either Header or TopNavBar THEN the system SHALL CONTINUE TO mark all notifications as read and refresh the list, exactly as it does today.

3.6 WHEN a user clears all notifications THEN the system SHALL CONTINUE TO delete all notifications for the current user and empty the displayed list, exactly as it does today.

3.7 WHEN the app is running in demo mode THEN the system SHALL CONTINUE TO use the seeded demo notifications and ignore Supabase realtime, exactly as it does today.

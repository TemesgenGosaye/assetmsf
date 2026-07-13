# Backend Migration Plan: From Supabase to Custom Django API

## Current State Analysis

### ✅ Already Migrated to Django
- Assets (`/api/assets/`)
- Employees (`/api/employees/`)
- Houses (`/api/houses/`)  
- Users (`/api/auth/users/`)
- Auth (`/api/auth/`)

### ❌ Still Using Supabase (NEEDS MIGRATION)

1. **Properties** (`src/services/properties.ts`)
   - CRUD: list, create, update, delete
   - Relations: assets, user_access, licenses

2. **Approvals** (`src/services/approvals.ts`)
   - CRUD: list, submit, forward, decide
   - Events tracking
   - Email notifications

3. **Tickets** (`src/services/tickets.ts`)
   - CRUD: list, create, update
   - Status workflow
   - Comments/events
   - Property-scoped assignments

4. **Residential Allocations** (`src/services/residentialAllocations.ts`)
   - Categories: permanent, seasonal, guest
   - CRUD for housing allocations

5. **Activity Log** (`src/services/activity.ts`)
   - Activity tracking
   - Realtime subscriptions

6. **Notifications** (`src/services/notifications.ts`)
   - User notifications
   - Role-based fan-out
   - Read/unread tracking

7. **Permissions** (`src/services/permissions.ts`)
   - Page-level permissions (view/edit)
   - Role defaults

8. **Departments** (`src/services/departments.ts`)
   - Simple CRUD

9. **Item Types** (`src/services/itemTypes.ts`)
   - Asset type categories

10. **QR Codes** (`src/services/qrcodes.ts`)
    - QR code generation tracking
    - Print status

11. **User Access** (`src/services/userAccess.ts`)
    - Property-level access control

12. **Audit** (multiple files)
    - Audit sessions
    - Audit scans
    - Audit assignments

13. **Reports** 
    - Report generation
    - Export tracking

14. **Settings**
    - User preferences
    - System settings

15. **Password Reset**
    - Reset tokens
    - Email verification

16. **Newsletter**
    - Subscriber management

17. **Ticket Attachments & Comments**
    - File uploads
    - Comment threads

18. **Final Approver** 
    - Property approver mappings

19. **Email Templates**
    - Template management

20. **User Department Access**
    - Department-level restrictions

## Implementation Strategy

### Phase 1: Core Infrastructure (PRIORITY)
1. **Properties** - Foundation for everything
2. **Departments** - Simple, no dependencies
3. **Item Types** - Needed for assets

### Phase 2: Access Control
4. **Permissions** - Page-level access
5. **User Access** - Property-level access  
6. **User Department Access** - Department restrictions

### Phase 3: Primary Features
7. **Approvals** - Workflow management
8. **Tickets** - Support system
9. **QR Codes** - Asset tracking

### Phase 4: Housing
10. **Residential Allocations** - Housing management

### Phase 5: Logging & Monitoring
11. **Activity Log** - Audit trail
12. **Notifications** - Alert system

### Phase 6: Reporting & Audit
13. **Audit Sessions** - Audit workflow
14. **Reports** - Analytics

### Phase 7: Remaining Features
15. All other services

## Technical Approach

For each service:
1. Remove Supabase imports
2. Create Django API endpoint
3. Implement djangoRequest-based service
4. Add caching where appropriate
5. Add demo/fallback support
6. Test all CRUD operations

## Success Criteria
- ✅ Zero Supabase imports in services
- ✅ All CRUD operations work via Django API
- ✅ Demo mode still functional
- ✅ Caching strategy maintained
- ✅ No breaking changes to UI components

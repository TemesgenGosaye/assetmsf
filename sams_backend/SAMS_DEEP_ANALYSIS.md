# SAMS Project Deep Analysis

## Executive Summary
SAMS (Smart Asset Management System) is a comprehensive enterprise asset management platform with multi-tenant architecture, role-based access control, approval workflows, audit capabilities, and extensive notification systems.

## Core Modules & Features

### 1. Authentication & Authorization
**Current Implementation**: Supabase Auth + Custom User Management
- Email-based authentication with password hashing (SHA256)
- Role-based access control: admin, manager, field_staff, auditor
- Page-level permissions with view/edit flags
- Property and department access scoping
- Final approver mapping per property

**Key Tables**:
- `app_users` - User profiles with role, department, status
- `user_permissions` - Page-level permissions (can_view, can_edit)
- `user_property_access` - Property access grants
- `user_department_access` - Department access grants
- `final_approvers` - Property-wise final approver mapping

### 2. Asset Management
**Current Implementation**: Supabase with localStorage fallback
- Asset lifecycle management (creation, updates, deletion)
- Asset codes with auto-generation (type prefix + property code + sequence)
- Categories/Item types (Furniture, Electronics, Vehicles, Machinery, Office Supplies, Other)
- AMC (Annual Maintenance Contract) tracking
- Purchase information (PO number, purchase date, expiry date)
- Condition tracking (Excellent, Good, Fair, Poor, Damaged)
- Location and department assignment
- Serial number tracking
- Bulk import via Excel with validation

**Key Tables**:
- `assets` - Main asset table
- `asset_types` - Asset categories
- `property_license` - Per-property asset limits

### 3. Maintenance/Ticket System
**Current Implementation**: Supabase with event logging
- Ticket states: BACKLOG, OPEN, IN_PROGRESS, WAITING_PARTS, ON_HOLD, RESOLVED, CLOSED
- Immutable closed tickets
- Ticket comments (stored as events)
- Ticket attachments (Supabase storage)
- Assignment workflow with email notifications
- Priority tracking
- SLA tracking

**Key Tables**:
- `maintenance_tickets` - Main ticket table
- `ticket_events` - Comments and status changes
- Supabase storage bucket: `tickets`

### 4. Approval Workflows
**Current Implementation**: Multi-level approval system
- Approval states: Pending, Under Review, Approved, Rejected, Cancelled, Completed
- Two-level approval: Manager → Admin
- Forwarding capability (manager can forward to admin)
- Final approver override per property
- Email notifications at each stage
- Audit trail of all actions

**Key Tables**:
- `approval_requests` - Main approval table
- `approval_events` - Audit trail of approval actions

### 5. Audit System
**Current Implementation**: Comprehensive audit module
- Audit sessions with frequency tracking
- Department assignments for audits
- Review submissions per department
- QR code scanning for asset verification
- Verified/damaged status tracking
- Audit report generation
- Incharge assignment

**Key Tables**:
- `audit_sessions` - Main session table
- `audit_assignments` - Department assignments
- `audit_reviews` - Review submissions
- `audit_reports` - Generated reports
- `audit_incharge` - Incharge assignments
- `audit_scans` - QR scan records

### 6. Properties & Departments
**Current Implementation**: Basic CRUD with access control
- Property management with status (active/inactive)
- Department management with hierarchy
- Property and department scoping for all data
- Access control via user_property_access and user_department_access

**Key Tables**:
- `properties` - Property records
- `departments` - Department records

### 7. Notifications
**Current Implementation**: In-app + Email
- In-app notifications with read status
- User-specific notifications
- Role-based notifications (admin, manager)
- Email notifications for:
  - Approval workflows
  - Ticket assignments
  - Audit sessions
  - User management
  - Newsletters

**Key Tables**:
- `notifications` - In-app notifications

### 8. Reports
**Current Implementation**: Report generation with filters
- Asset reports
- Maintenance reports
- Audit reports
- Filter metadata (session_id, department, property, asset_type)
- File URL tracking
- Creator tracking

**Key Tables**:
- `reports` - Report records

### 9. QR Code Management
**Current Implementation**: QR generation and tracking
- QR code generation for assets
- Asset name enrichment
- Printed status tracking
- Image URL storage
- Caching mechanism

**Key Tables**:
- `qr_codes` - QR code records

### 10. License Management
**Current Implementation**: Plan-based licensing
- Property-based asset limits
- Plan tiers: free (100), standard (500), pro (2500), business (unlimited)
- Global limits
- License checking before asset creation
- License snapshots for dashboard

**Key Tables**:
- `property_license` - Per-property licenses
- `license_meta` - Global license configuration

### 11. Settings
**Current Implementation**: System and user settings
- System settings (timezone, language, backup frequency)
- User settings (notifications, email notifications, dark mode, dashboard prefs)

**Key Tables**:
- `system_settings` - Singleton system configuration
- `user_settings` - Per-user preferences

### 12. Activity Logging
**Current Implementation**: Recent activity tracking
- User-specific activity feed
- Activity types (system, asset_created, qr_generated, report)
- Real-time subscriptions
- Demo mode seeding

**Key Tables**:
- `recent_activity` - Activity records

### 13. Email System
**Current Implementation**: Edge function + Resend
- Beautiful HTML email templates
- Approval emails (submitted, forwarded, approved, rejected)
- Newsletter emails
- Ticket emails (assigned, status update)
- Audit emails (started, submitted)
- User management emails (welcome, password reset)
- Email preference checking
- Admin/manager email retrieval

## Data Relationships

### User Relationships
- User → Department (many-to-one)
- User → Property Access (many-to-many via user_property_access)
- User → Department Access (many-to-many via user_department_access)
- User → Permissions (one-to-many via user_permissions)
- User → Final Approver Properties (many-to-many via final_approvers)

### Asset Relationships
- Asset → Property (many-to-one)
- Asset → Department (many-to-one)
- Asset → Category/Type (many-to-one)
- Asset → QR Code (one-to-one)
- Asset → Maintenance Tickets (one-to-many)
- Asset → Audit Scans (one-to-many)

### Ticket Relationships
- Ticket → Asset (many-to-one)
- Ticket → Assigned User (many-to-one)
- Ticket → Events (one-to-many)
- Ticket → Attachments (one-to-many)

### Approval Relationships
- Approval → Asset (many-to-one)
- Approval → Requester (many-to-one)
- Approval → Current Approver (many-to-one)
- Approval → Events (one-to-many)

### Audit Relationships
- Audit Session → Property (many-to-one)
- Audit Session → Assignments (one-to-many)
- Audit Assignment → Department (many-to-one)
- Audit Assignment → Reviews (one-to-many)
- Audit Session → Scans (one-to-many)

## Business Rules

### Access Control
1. **Admin Role**: Full access to all pages, all properties, all departments
2. **Manager Role**: Access to assets, properties, qrcodes, reports (view only), settings (view only)
3. **User Role**: Access to assets, qrcodes, settings (view only)
4. **Property Access**: Users can only see assets in properties they have access to (unless all_properties permission)
5. **Department Access**: Users can only see assets in departments they have access to (unless all_departments permission)

### Asset Rules
1. Asset codes auto-generated: {type_prefix}{property_code}{sequence}
2. License check before asset creation
3. Property access enforced during import
4. Department access enforced during import
5. Quantity handling: bulk import creates multiple asset records

### Ticket Rules
1. Closed tickets are immutable (no status changes, comments, or edits)
2. Status transitions must follow valid paths
3. Assignment based on property access
4. Email notifications on assignment and status changes

### Approval Rules
1. Two-level approval: Manager → Admin
2. Manager can forward to admin
3. Final approver can override per property
4. Email notifications at each stage
5. Audit trail of all actions

### Audit Rules
1. Sessions can be started/ended by authorized users
2. Departments assigned to sessions
3. Reviews submitted per department
4. QR scanning for asset verification
5. Verified/damaged status tracking

## Technical Patterns

### Supabase Patterns
1. **RLS (Row Level Security)**: Used for access control
2. **RPC Functions**: SECURITY DEFINER functions for privileged operations
3. **Storage**: Supabase storage for file uploads
4. **Realtime**: Subscriptions for activity feed
5. **localStorage Fallback**: Demo mode and offline support

### Data Transformation
1. **camelCase ↔ snake_case**: Conversion between frontend and backend
2. **Dynamic Column Probing**: Handling schema evolution
3. **RPC Fallback**: Try RPC, fall back to direct operations
4. **Local Mirroring**: Cache remote data locally for consistency

## Migration Requirements for Django

### Authentication
- Replace Supabase Auth with Django custom User model
- Implement JWT authentication
- Implement password hashing (bcrypt/argon2)
- Migrate user permissions to Django permissions
- Implement property/department access models

### Database
- Migrate all Supabase tables to Django models
- Implement UUID primary keys
- Implement soft delete (is_active)
- Implement audit fields (created_at, updated_at, created_by, updated_by)
- Implement indexes for performance

### Business Logic
- Move business logic from frontend services to Django services
- Implement immutable closed tickets
- Implement license checking
- Implement approval workflows
- Implement audit session management

### File Storage
- Replace Supabase storage with Django file storage
- Implement ticket attachment handling
- Implement QR code image storage

### Email
- Implement email sending via Django
- Port email templates
- Implement email preference checking

### Real-time
- Implement WebSocket support for activity feed
- Or implement polling mechanism

## Performance Considerations

### Indexes Required
- assets: property_id, department_id, status, type, created_at
- maintenance_tickets: asset_id, assigned_to, status, created_at
- approval_requests: asset_id, requester_id, current_approver_id, status
- audit_sessions: property_id, status, created_at
- user_property_access: user_id, property_id
- user_department_access: user_id, department
- notifications: user_id, read, created_at

### Query Optimization
- Use select_related for foreign keys
- Use prefetch_related for many-to-many
- Implement custom managers for permission filtering
- Implement caching for frequently accessed data

## Security Requirements

### Authentication
- JWT with refresh tokens
- Token rotation
- Token blacklisting
- Password strength requirements

### Authorization
- Role-based permissions
- Object-level permissions
- Property/department scoping
- Automatic permission enforcement via querysets

### Data Protection
- SQL injection protection (Django ORM)
- XSS protection (Django templates)
- CSRF protection (Django CSRF)
- Secure headers
- Rate limiting

## Testing Requirements

### Unit Tests
- Model tests
- Serializer tests
- Permission tests
- Service tests

### Integration Tests
- API tests
- Workflow tests
- Email tests

### Coverage Target
- 90% code coverage

## Deployment Considerations

### Environment Variables
- Database configuration
- JWT settings
- Email configuration
- CORS settings
- Static/media file configuration

### Scaling
- Database connection pooling
- Caching (Redis)
- Celery for background tasks (email, notifications)
- Gunicorn/uWSGI for production
- Nginx for reverse proxy

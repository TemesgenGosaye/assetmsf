# Requirements Document

## Introduction

The Row Detail Panel feature adds a reusable, right-side slide-in Sheet panel to the SAMS application. When a user double-clicks any table row on any of the eight data pages (Assets, Users, Employees, Tickets, Approvals, Properties, QR Codes, Audit), the panel opens and displays all fields of that record in a clean, sectioned layout. The feature must be implemented as a single shared component — not duplicated per page — and must meet SAMS's existing professional visual standard using shadcn/ui and Tailwind CSS.

## Glossary

- **Detail_Panel**: The right-side sliding Sheet component that renders a full record's fields when triggered.
- **Host_Page**: Any of the eight pages that contain data tables: Assets, Users, Employees, Tickets, Approvals, Properties, QR Codes, Audit.
- **Record**: A single data object bound to one table row (e.g., an Asset, Employee, User, Ticket, etc.).
- **Record_Schema**: The set of field names, labels, and value types that describe a particular entity.
- **Field_Renderer**: The sub-component responsible for converting a raw field value to a human-readable, formatted display.
- **Section**: A visual grouping of related fields within the Detail_Panel (e.g., "Identity", "Status", "Dates").
- **DataTable**: The shared `src/components/table/DataTable.tsx` component used by Employees and other pages to render tabular data.
- **Double_Click_Trigger**: The `onDoubleClick` DOM event on a table row `<tr>` element that opens the Detail_Panel.
- **ESC_Key**: The keyboard key that closes the Detail_Panel when pressed.

## Requirements

### Requirement 1: Double-Click Trigger on DataTable Rows

**User Story:** As a user, I want to double-click any row in a DataTable-based table, so that I can open the detail panel and view the full record without leaving the current page.

#### Acceptance Criteria

1. WHEN a user double-clicks a row in any `DataTable` component, THE `DataTable` SHALL invoke an `onRowDoubleClick` callback with the row's data object.
2. WHEN `onRowDoubleClick` is not provided to `DataTable`, THE `DataTable` SHALL render rows without double-click behaviour, preserving existing functionality unchanged.
3. WHEN a double-click event occurs on a row, THE `DataTable` SHALL stop the event from also triggering any other row-level click handlers.
4. THE `DataTable` component SHALL accept an optional `onRowDoubleClick` prop of type `(row: T) => void`.

---

### Requirement 2: Double-Click Trigger on Native Table Rows

**User Story:** As a user, I want to double-click any row in pages that use native `<table>` markup (Assets, Users, Properties, QR Codes, Audit), so that I can open the detail panel consistently across all pages.

#### Acceptance Criteria

1. WHEN a user double-clicks a `<tr>` row element on any Host_Page using a native table, THE Host_Page SHALL invoke the Detail_Panel with that row's Record.
2. WHEN a double-click event occurs on a row action button (Edit, Delete, etc.), THE Host_Page SHALL NOT open the Detail_Panel.
3. WHILE the Detail_Panel is already open, WHEN a user double-clicks a different row, THE Detail_Panel SHALL update to show the newly selected Record.

---

### Requirement 3: Detail Panel Component

**User Story:** As a user, I want the detail panel to slide in from the right side of the screen, so that I can view record details without losing context of the underlying table.

#### Acceptance Criteria

1. WHEN a Record is provided to the Detail_Panel, THE Detail_Panel SHALL render as a shadcn/ui `Sheet` component positioned on the right side of the viewport.
2. THE `Detail_Panel` SHALL accept the following props: `open: boolean`, `onClose: () => void`, `record: Record<string, unknown> | null`, and `schema: RecordSchema`.
3. THE Detail_Panel SHALL display a header containing the record's primary identifier (e.g., name, ID, or title) and a close button.
4. WHEN the Detail_Panel is open and the user presses the ESC key, THE Detail_Panel SHALL close.
5. WHEN the Detail_Panel is open and the user clicks the backdrop overlay, THE Detail_Panel SHALL close.
6. THE Detail_Panel SHALL apply a smooth slide-in animation from the right edge of the viewport with a duration of no more than 300ms.
7. THE Detail_Panel SHALL be accessible: the close button SHALL have an `aria-label`, focus SHALL be trapped within the panel while open, and the panel SHALL be announced to screen readers.

---

### Requirement 4: Field Rendering and Layout

**User Story:** As a user, I want each record's fields displayed in clearly labelled sections, so that I can quickly read all details without confusion.

#### Acceptance Criteria

1. THE Detail_Panel SHALL organise fields into named Sections, where each Section contains one or more labelled field rows.
2. WHEN a field value is `null`, `undefined`, or an empty string, THE Field_Renderer SHALL display a "—" placeholder instead of a blank value.
3. WHEN a field value represents a date or timestamp, THE Field_Renderer SHALL format it using the locale date/time format (e.g., `toLocaleDateString`).
4. WHEN a field value is a boolean, THE Field_Renderer SHALL display a Badge reading "Yes" or "No" with appropriate colour coding.
5. WHEN a field is designated as a status field in its schema, THE Field_Renderer SHALL render it as a coloured Badge consistent with the existing `StatusBadge` patterns used in the Host_Pages.
6. WHEN a field value is a URL or file path, THE Field_Renderer SHALL render it as a clickable link that opens in a new tab.
7. THE Detail_Panel layout SHALL use a two-column grid for wide viewports (≥ 640px) and a single-column stack for narrow viewports (< 640px).

---

### Requirement 5: Per-Page Record Schemas

**User Story:** As a developer, I want each page to supply its own record schema to the detail panel, so that field labels, sections, and display types are correct for each entity type.

#### Acceptance Criteria

1. THE system SHALL provide a record schema for each Host_Page: Assets, Users, Employees, Tickets, Approvals, Properties, QR Codes, and Audit.
2. EACH record schema SHALL declare for every field: a human-readable `label`, the `section` it belongs to, and an optional `type` hint (`"date"`, `"boolean"`, `"status"`, `"url"`, or `"text"`).
3. WHEN a field key present in the Record has no corresponding entry in the schema, THE Field_Renderer SHALL still display the raw value under a fallback section titled "Other".
4. THE Assets record schema SHALL include sections: "Identity", "Location & Classification", "Dates & Lifecycle", and "Status".
5. THE Employees record schema SHALL include sections: "Identity", "Position & Department", "Dates & HR", and "Status".
6. THE Users record schema SHALL include sections: "Account", "Contact", and "Status".
7. THE Tickets record schema SHALL include sections: "Ticket Info", "Assignment", and "Status".
8. THE Approvals record schema SHALL include sections: "Request", "Review", and "Status".
9. THE Properties record schema SHALL include sections: "Identity" and "Status".
10. THE QR Codes record schema SHALL include sections: "QR Info", "Asset Link", and "Status".
11. THE Audit record schema SHALL include sections: "Session", "Assignment", and "Status".

---

### Requirement 6: Reusable Architecture

**User Story:** As a developer, I want the detail panel implemented as a single shared component, so that I can integrate it into any new page with minimal boilerplate.

#### Acceptance Criteria

1. THE Detail_Panel SHALL be implemented as a single React component located at `src/components/common/RecordDetailPanel.tsx`.
2. THE Detail_Panel SHALL NOT contain any page-specific logic or hard-coded field references.
3. WHEN a new entity type is added to SAMS, a developer SHALL be able to support it in the Detail_Panel by supplying only a new record schema object, without modifying the Detail_Panel component itself.
4. THE system SHALL export a `useRecordDetailPanel` hook from `src/hooks/useRecordDetailPanel.ts` that returns `{ open, record, schema, openPanel, closePanel }` state helpers.
5. THE `useRecordDetailPanel` hook SHALL accept a `schema` parameter of the schema to use for that panel instance.

---

### Requirement 7: Visual Design and Polish

**User Story:** As a user, I want the detail panel to look professional and consistent with the rest of SAMS, so that it feels like a native part of the application.

#### Acceptance Criteria

1. THE Detail_Panel SHALL use the application's existing design tokens (CSS variables for `--background`, `--foreground`, `--border`, `--muted`, `--primary`, etc.) so that it renders correctly in both light and dark modes.
2. THE Detail_Panel header SHALL display a relevant icon representing the entity type alongside the record title.
3. WHEN a row is double-clickable, THE Host_Page SHALL apply a `cursor-pointer` style to that row so users understand it is interactive.
4. THE Detail_Panel SHALL display Section headings as visually distinct labels that separate groups of fields.
5. THE Detail_Panel width SHALL be `w-full sm:max-w-lg` (full width on mobile, capped at 512px on larger screens).

---

### Requirement 8: Integration into All Host Pages

**User Story:** As a product owner, I want all eight data pages integrated with the detail panel, so that users get a consistent experience across the entire application.

#### Acceptance Criteria

1. THE Assets page SHALL integrate the Detail_Panel using the Assets record schema and open it on row double-click.
2. THE Users page SHALL integrate the Detail_Panel using the Users record schema and open it on row double-click.
3. THE Employees page SHALL integrate the Detail_Panel via the `DataTable` component's `onRowDoubleClick` prop and the Employees record schema.
4. THE Tickets page SHALL integrate the Detail_Panel using the Tickets record schema and open it on row double-click.
5. THE Approvals page SHALL integrate the Detail_Panel using the Approvals record schema and open it on row double-click.
6. THE Properties page SHALL integrate the Detail_Panel using the Properties record schema and open it on row double-click.
7. THE QR Codes page SHALL integrate the Detail_Panel using the QR Codes record schema and open it on row double-click.
8. THE Audit page SHALL integrate the Detail_Panel using the Audit record schema and open it on row double-click.
9. WHEN the Detail_Panel is open on any Host_Page, THE Host_Page SHALL continue to render and remain fully interactive behind the panel overlay.

---

### Requirement 9: Conflict-Free Interaction with Existing Row Actions

**User Story:** As a user, I want existing click, edit, and delete buttons to continue working exactly as before, so that the new double-click feature does not interfere with my workflow.

#### Acceptance Criteria

1. WHEN a user single-clicks a row, THE Host_Page SHALL NOT open the Detail_Panel.
2. WHEN a user clicks an action button (Edit, Delete, View, Forward, etc.) inside a row, THE Host_Page SHALL perform the existing action and SHALL NOT open the Detail_Panel.
3. WHEN a user double-clicks a row while a modal dialog (add, edit, delete confirmation) is already open, THE Detail_Panel SHALL NOT open.
4. IF the Detail_Panel is open and a user opens a modal dialog (add/edit/delete), THEN THE Detail_Panel SHALL close before the modal dialog becomes active.

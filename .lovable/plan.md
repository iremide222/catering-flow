# CaterFlow ERP — Phased Build Plan

Based on your SOW, here's how I'd break the build into delivery phases. Each phase is independently usable, so you get value early and we de-risk the bigger modules (finance, procurement, mobile) by building on a stable core.

## Phase 0 — Foundation (setup)
- Enable Lovable Cloud (database, auth, storage, server functions).
- Design system, app shell, navigation, dark/light themes.
- Auth: email/password login, password reset, session handling.
- Role-based access control: Admin, Manager, Accountant, Store Manager, Staff (roles in a separate `user_roles` table with `has_role()` security-definer).
- Audit log table + helper to record sensitive actions.

## Phase 1 — CRM + Event Management (revenue core)
- Customer database: contacts, preferences, tags, event history, spend totals.
- Event lifecycle: Inquiry → Quotation → Confirmed → Planning → Execution → Delivered → Closed.
- Quotation builder with line items, taxes, discounts; PDF export.
- Event calendar view + per-event detail page (menu, guests, venue, timeline).
- Follow-up reminders.

## Phase 2 — Inventory + Procurement
- Items, categories, units, stock levels per location/store.
- Stock in/out movements, adjustments, low-stock alerts.
- Suppliers, purchase requests, purchase orders, goods receipt.
- Link POs to events; supplier performance metrics.

## Phase 3 — Staff + Task Management
- Employee records, departments, contracts, documents.
- Attendance (check-in/out), shifts, leave requests.
- Task assignment with priorities, deadlines, status, notifications.
- Link tasks/staff to events.

## Phase 4 — Finance
- Revenue from events/invoices; expenses (with categories).
- Payroll generation from staff + attendance.
- Cash-flow view, P&L per event and per period.
- Accountant-only views and approvals.

## Phase 5 — Reporting, Analytics & Notifications
- KPI dashboards per role (Admin, Manager, Accountant, Store).
- Operational, financial, inventory, and event trend reports.
- Centralized notifications + email alerts (inventory low, event milestones, overdue tasks, finance thresholds).

## Phase 6 — Security Hardening & Audit
- Full activity logs UI, encryption-at-rest review, scheduled backups.
- Two-factor authentication (TOTP).
- RLS policy review across all tables.

## Phase 7 — Mobile App (separate track)
- Out of scope for the Lovable web build. Recommended as a separate React Native / Expo project consuming the same backend APIs.
- Manager view: dashboards, approvals, event status.
- Staff view: tasks, attendance check-in, event checklists.

## Phase 8 — Deliverables wrap-up
- API documentation (auto-generated from server functions + public routes).
- User manuals per role.
- Deployment guide.

## Technical notes
- Stack: TanStack Start (React 19 + Vite) + Lovable Cloud (Postgres, Auth, Storage, Server Functions).
- All roles stored in `user_roles` table — never on profiles — with a `has_role()` security-definer function for RLS.
- Every public-schema table gets explicit `GRANT`s + RLS policies in the same migration.
- PDFs (quotations, invoices, payroll) generated server-side via server functions.

---

## Questions before I start Phase 0
1. Single-tenant (one catering company) or multi-tenant (many companies on one install)?
2. Currency + language defaults?
3. Do you want me to start building Phase 0 + Phase 1 now, or adjust the phasing first?

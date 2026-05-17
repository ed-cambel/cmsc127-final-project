# OnLine — UPV Smart Queue Management

A web-based queue management system for UPV offices (Cash Office, OUR, College Secretary, Guidance Service). Customers join queues remotely, staff serve them in order, and admins manage the system.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [User Roles](#user-roles)
3. [Account Registration & Login](#account-registration--login)
4. [Customer Guide](#customer-guide)
5. [Staff Guide](#staff-guide)
6. [Admin Guide](#admin-guide)
7. [Consent-Based Position Switching](#consent-based-position-switching)
8. [Security Notes](#security-notes)
9. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Prerequisites

- **XAMPP** (Apache + MySQL + PHP 7.3 or newer)
- A modern browser (Chrome, Firefox, Edge)

### Installation

1. **Install XAMPP** from [apachefriends.org](https://www.apachefriends.org/).
2. **Place the project** in XAMPP's `htdocs` directory, or symlink it:
   ```cmd
   mklink /D "D:\xampp\htdocs\cmsc127-final-project" "C:\path\to\your\cmsc127-final-project"
   ```
   (Run as Administrator. Adjust paths for your XAMPP install location.)
3. **Start Apache and MySQL** from the XAMPP Control Panel.
4. **Import the database**:
   ```cmd
   "D:\xampp\mysql\bin\mysql.exe" -u root < "C:\path\to\database.sql"
   ```
   Or via phpMyAdmin → **Import** → select `database.sql`.
5. **Verify**: open http://localhost/phpmyadmin and confirm `upv_queue_db` exists with these tables:
   `users`, `locations`, `services`, `queues`, `staff`, `queue_switch_requests`.
6. **Open the app**: http://localhost/cmsc127-final-project/

### First Login

The database seeds several test accounts, all sharing the same password (set directly in the seed data). Sign in with any of the following:

| Username           | Role     |
|--------------------|----------|
| `admin_reyes`      | admin    |
| `staff_santos`     | staff    |
| `staff_dela_cruz`  | staff    |
| `juan_dela_cruz`   | customer |
| `maria_santos`     | customer |
| `carlos_reyes`     | customer |

If you need to change a password, the admin can do so from the **Users** page after logging in.

---

## User Roles

The system has three roles with progressively expanding permissions:

| Role        | Can do                                                                       |
|-------------|------------------------------------------------------------------------------|
| `customer`  | Join queues, cancel own entry, request position switches with other customers |
| `staff`     | All customer abilities + serve next, skip, re-add, immediate position swap, manage services/staff |
| `admin`     | All staff abilities + manage users, delete any queue record, manage locations |

Self-registration creates `customer` accounts only. Staff and admin accounts must be created by an existing admin.

---

## Account Registration & Login

### Creating an Account

1. On the login page, click **"Don't have an account? Sign up"**.
2. Enter a username (3–50 characters, letters / numbers / underscore only) and a password (minimum 8 characters).
3. Click **Create Account**. You're logged in immediately as a `customer`.

### Logging In

Enter username + password, click **Sign In**. Session persists until you click **Sign out** or your browser session ends.

---

## Customer Guide

### Dashboard

The dashboard shows a live card for every service:

- **Now Serving** — the queue number currently being served.
- **Waiting** — how many are ahead, and a strip of pending numbers.
- **Join Queue** button — adds you to the queue. You can be in any service's queue at most once per day.
- **Your status** — once you join, your card shows your number and a **Cancel** button.

### My Queues page

A filterable record of every queue entry. Use the filters to view:
- A specific date
- A specific service
- A specific status (waiting / serving / served / skipped / cancelled)

You'll see a **Request Switch** button on other customers' waiting rows in services where you also have a waiting entry. See [Consent-Based Position Switching](#consent-based-position-switching) below.

### Switch Requests Inbox

The **🔔 Switch Requests** button in the sidebar shows a badge with the count of pending incoming requests. Click it to see:
- **Incoming** — requests from others to swap with you (Accept / Reject).
- **Your pending requests** — outgoing requests you've sent (Cancel).

The system polls every 12 seconds, so new requests appear with a toast notification within seconds.

---

## Staff Guide

Staff see everything customers see, plus:

### Queue Board page

The operational view for serving customers. For each service:
- **Next ▸** — marks the current "serving" entry as "served" and promotes the next waiting entry to "serving".
- **Skip** — marks an entry as "skipped". The customer can be re-added later.
- **Re-add to Front** — moves a skipped customer back to the front of the waiting list (other waiting entries shift one position back).

### Queue Records — administrative swap

Staff see a **Switch** button on any waiting entry. Clicking it opens a picker letting you swap two entries' positions immediately (no consent needed — administrative override). The two entries must be in the same service and date.

### Services management

Read-only listing of services. Editing requires admin.

### Staff management

Read-only listing of who is assigned to which service. Editing requires admin.

---

## Admin Guide

Admins see everything staff see, plus:

### Users page

Full CRUD over user accounts:
- Create users with role `customer`, `staff`, or `admin`.
- Edit username, role, and (optionally) password.
- Delete users — this cascades and removes all their queue records.

### Services page (full CRUD)

- Add a new service (name + description + location).
- Edit existing services.
- Delete services — this cascades and removes all queue records for that service.

### Staff assignments

- Assign a user (any role) to a service with a staff role label (e.g., "Cashier", "Registrar Clerk").
- Edit or remove assignments.

### Queue Records

Admins can additionally **Delete** any queue record permanently.

---

## Consent-Based Position Switching

Customers cannot unilaterally swap positions with strangers. All customer-initiated swaps require the other party's consent.

### How a customer requests a switch

1. Be in a waiting queue for some service.
2. Open **My Queues**, find another customer's waiting row in that same service.
3. Click **Request Switch** → confirm.
4. A toast appears: "Switch request sent — waiting for response."

### How the other party responds

1. Their **🔔 Switch Requests** badge increments; a toast says "<your username> wants to switch positions with you".
2. They open the inbox, see your request with both queue numbers.
3. They click **Accept** — your numbers swap atomically. The system also auto-cancels any other pending requests involving either of you, so stale requests don't pile up.
4. Or they click **Reject** — no change; you'll see your outgoing request flip to `rejected` on your next poll.

### Cancellation & expiry

- The requester can **Cancel** a pending request from their outgoing list.
- If either party gets served, skipped, cancelled, or the day rolls over, the request is automatically marked `expired` on the next inbox read.

### Staff override

Staff and admin can directly swap any two waiting entries in the same service/date from the Queue Records page, bypassing the consent flow. This is for in-person reordering at the counter (e.g., a customer asks staff to let someone go ahead).

---

## Security Notes

The system has several defenses worth understanding:

### Authentication & Sessions

- Passwords are stored as bcrypt hashes (`password_hash` with `PASSWORD_DEFAULT`, cost 12).
- Sessions use PHP cookies with `HttpOnly`, `SameSite=Lax`, and `Secure` (when served over HTTPS).
- Logging out destroys the server-side session.

### CSRF Protection

Three layers prevent cross-site request forgery:

1. **`SameSite=Lax` session cookie** — browsers won't send the session cookie on most cross-origin POSTs.
2. **JSON-only enforcement** — all state-changing requests (POST / PUT / DELETE) must have `Content-Type: application/json`. This forces a CORS preflight that attacker sites can't satisfy.
3. **Origin / Referer check** — the server rejects state-changing requests whose `Origin` or `Referer` host doesn't match the server's host.

### Authorization

- Public registration is locked to `role=customer`; the `role` field in registration is ignored.
- Customer-initiated switches verify the requester owns the `from_queue_id` entry.
- Switch acceptance verifies the responder owns the `to_queue_id` entry.
- Direct (no-consent) swap is restricted to `staff` / `admin`.
- All admin endpoints (user CRUD, service CRUD, staff CRUD, queue deletion) require `role=admin`.

### Input Validation

- All SQL uses parameterized PDO prepared statements — no string concatenation.
- Username regex: `^[A-Za-z0-9_]+$`, 3–50 chars.
- Password minimum: 8 chars.
- All user-rendered HTML in the frontend is escaped via `esc()` (textContent → innerHTML).

---

## Troubleshooting

### "Unexpected token '<' ... is not valid JSON"

The API returned an HTML PHP error page instead of JSON. Open DevTools → Network tab → click the failing request → Response. Common causes:

- **`Unknown database 'upv_queue_db'`** — database not imported. See [Installation](#installation) step 4.
- **`Table 'queue_switch_requests' doesn't exist`** — re-import `database.sql` or run the table's `CREATE TABLE` manually in phpMyAdmin's SQL tab (make sure `upv_queue_db` is selected first).
- **`session_set_cookie_params() expects parameter 1 to be integer`** — your PHP is older than 7.3. Upgrade XAMPP.

### "Invalid credentials" on every login

You're typing the wrong password for that account. The seeded accounts share the password set in the seed data — confirm with the project owner if you're unsure. As a last resort, an admin can update any password via the Users page, or you can run a one-line UPDATE in phpMyAdmin with a fresh bcrypt hash.

### "Cross-origin request blocked"

You're accessing the app from a different host than the API (e.g., opening `index.html` via `file://`). Always access through Apache at `http://localhost/cmsc127-final-project/`.

### MySQL won't start in XAMPP

Usually a port 3306 conflict with an existing MySQL service. Stop the Windows MySQL service, or change XAMPP's MySQL port in `my.ini` and update `DB_HOST` in `includes/db.php` accordingly.

### Apache won't start

Port 80 conflict. Common culprits: Skype, IIS, World Wide Web Publishing Service. Stop the conflicting service or change Apache's port in `httpd.conf`.

### Switch button doesn't appear for a customer

By design, the **Request Switch** button appears only on **other people's** waiting rows in services where the current customer **also has a waiting entry**. If you're not in that queue, no switch button shows for it — join the queue first.

### Changes to JS not appearing

Browsers cache aggressively. Force a hard refresh with **Ctrl + F5** (Windows) or **Cmd + Shift + R** (Mac).

---

## Database Schema Reference

| Table                    | Purpose                                                    |
|--------------------------|------------------------------------------------------------|
| `users`                  | Accounts (username, password hash, role)                   |
| `locations`              | Buildings on campus                                        |
| `services`               | Office services tied to locations                          |
| `queues`                 | Daily queue entries (service, user, number, date, status)  |
| `staff`                  | Mapping of staff users to assigned services                |
| `queue_switch_requests`  | Pending/resolved consent-based switch requests             |

All foreign keys cascade on delete to keep the data consistent when parent rows are removed.

---

## Quick API Reference

All API endpoints are under `/api/` and accept/return JSON. State-changing requests require `Content-Type: application/json` and a same-origin Origin/Referer.

| Endpoint                                            | Method | Auth         | Purpose                              |
|-----------------------------------------------------|--------|--------------|--------------------------------------|
| `/api/auth.php?action=register`                     | POST   | none         | Create customer account              |
| `/api/auth.php?action=login`                        | POST   | none         | Sign in                              |
| `/api/auth.php?action=logout`                       | POST   | session      | Sign out                             |
| `/api/auth.php?action=session`                      | GET    | none         | Check current session                |
| `/api/queues.php`                                   | GET    | none         | List queue entries (filterable)      |
| `/api/queues.php?action=join`                       | POST   | any login    | Join a service queue                 |
| `/api/queues.php?action=cancel`                     | POST   | owner/staff  | Cancel a queue entry                 |
| `/api/queues.php?action=next`                       | POST   | staff/admin  | Serve next customer                  |
| `/api/queues.php?action=skip`                       | POST   | staff/admin  | Mark entry as skipped                |
| `/api/queues.php?action=readd`                      | POST   | staff/admin  | Re-add a skipped entry to front      |
| `/api/queues.php?action=switch`                     | POST   | staff/admin  | Immediate position swap (override)   |
| `/api/queues.php?action=switch_request`             | POST   | any login    | Send a consent-based switch request  |
| `/api/queues.php?action=switch_respond`             | POST   | recipient    | Accept or reject a switch request    |
| `/api/queues.php?action=switch_cancel`              | POST   | requester    | Cancel an outgoing switch request    |
| `/api/queues.php?action=my_switch_requests`         | GET    | any login    | List incoming + outgoing requests    |
| `/api/queues.php`                                   | DELETE | admin        | Permanently delete a queue record    |
| `/api/services.php`                                 | GET    | none         | List services                        |
| `/api/services.php`                                 | POST/PUT/DELETE | admin | Manage services                     |
| `/api/locations.php`                                | GET    | none         | List locations                       |
| `/api/locations.php`                                | POST/PUT/DELETE | admin | Manage locations                    |
| `/api/staff.php`                                    | GET    | none         | List staff assignments               |
| `/api/staff.php`                                    | POST/PUT/DELETE | admin | Manage staff assignments            |
| `/api/users.php`                                    | GET    | any login    | List users (full list for staff/admin, self for customer) |
| `/api/users.php`                                    | POST/PUT/DELETE | admin | Manage users                        |

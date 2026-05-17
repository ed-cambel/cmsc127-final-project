# OnLine — UPV Smart Queue Management System

A vanilla HTML/CSS/JS + PHP CRUD web application for managing service queues at UPV.

## Requirements

- PHP 7.4+ with PDO MySQL extension
- MySQL 5.7+ or MariaDB 10.3+
- A local web server (XAMPP, WAMP, Laragon, or `php -S`)

## Setup

1. **Import the database:**

   ```bash
   mysql -u root -p < database.sql
   ```

2. **Configure the database connection** (if needed):

   Edit `includes/db.php` and update `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`.

3. **Start the PHP dev server:**

   ```bash
   cd online-queue
   php -S localhost:8000
   ```

4. **Open** `http://localhost:8000` in your browser.

## Default Login Credentials

All seeded users share the password: `password123`

| Username          | Role     |
|-------------------|----------|
| `admin_reyes`     | admin    |
| `staff_santos`    | staff    |
| `staff_dela_cruz` | staff    |
| `staff_garcia`    | staff    |
| `staff_mendoza`   | staff    |
| `juan_dela_cruz`  | customer |
| `maria_santos`    | customer |
| `carlos_reyes`    | customer |
| `ana_lim`         | customer |
| `pedro_tan`       | customer |
| `liza_flores`     | customer |
| `mark_villanueva` | customer |
| `rose_aquino`     | customer |

## Features

### Customer
- View live queue board for all services
- Join a queue for any service
- Cancel their own queue entry
- Switch positions with another waiting user

### Staff
- Queue Board: call next, skip, re-add skipped users to front
- View and filter all queue records by date/service/status

### Admin (all staff features plus)
- Full CRUD on Services, Staff assignments, Users, and Locations
- Delete queue records
- Create/edit users with role management

### Special Queue Logic
- **Switch:** Two waiting users in the same queue can swap positions
- **Skip & Re-add:** Staff can skip late users; skipped users can be re-added to the front of the waiting list

## Project Structure

```
online-queue/
├── index.html              # Single-page app entry
├── database.sql            # Schema + seed data
├── README.md
├── css/
│   └── style.css           # Full stylesheet
├── js/
│   ├── app.js              # API client, state, toast, modals
│   └── pages.js            # All page renderers + actions
├── api/
│   ├── auth.php            # Login / logout / session
│   ├── queues.php          # Queue CRUD + join/next/skip/readd/switch
│   ├── services.php        # Service CRUD
│   ├── staff.php           # Staff assignment CRUD
│   ├── users.php           # User CRUD
│   └── locations.php       # Location CRUD
└── includes/
    ├── db.php              # PDO connection + helpers
    └── auth.php            # Session + role guards
```

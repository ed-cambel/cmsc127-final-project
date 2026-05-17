-- OnLine Queue Management System — SQL Seeder

CREATE DATABASE IF NOT EXISTS upv_queue_db;
USE upv_queue_db;

-- SCHEMA

CREATE TABLE IF NOT EXISTS users (
    user_id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('customer', 'staff', 'admin') NOT NULL DEFAULT 'customer',
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS locations (
    location_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    building_name VARCHAR(100) NOT NULL UNIQUE,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS services (
    service_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL,
    description  TEXT,
    location_id  INT UNSIGNED NOT NULL,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS queues (
    queue_id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    service_id   INT UNSIGNED NOT NULL,
    user_id      INT UNSIGNED NOT NULL,
    queue_number INT UNSIGNED NOT NULL,
    queue_date   DATE         NOT NULL,
    queue_status ENUM('waiting', 'serving', 'served', 'skipped', 'cancelled') NOT NULL DEFAULT 'waiting',
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_id) REFERENCES services(service_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)    REFERENCES users(user_id)       ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS queue_switch_requests (
    request_id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    from_queue_id  INT UNSIGNED NOT NULL,
    to_queue_id    INT UNSIGNED NOT NULL,
    from_user_id   INT UNSIGNED NOT NULL,
    to_user_id     INT UNSIGNED NOT NULL,
    status         ENUM('pending','accepted','rejected','cancelled','expired') NOT NULL DEFAULT 'pending',
    created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at   TIMESTAMP    NULL,
    FOREIGN KEY (from_queue_id) REFERENCES queues(queue_id) ON DELETE CASCADE,
    FOREIGN KEY (to_queue_id)   REFERENCES queues(queue_id) ON DELETE CASCADE,
    FOREIGN KEY (from_user_id)  REFERENCES users(user_id)   ON DELETE CASCADE,
    FOREIGN KEY (to_user_id)    REFERENCES users(user_id)   ON DELETE CASCADE,
    INDEX idx_to_pending   (to_user_id, status),
    INDEX idx_from_pending (from_user_id, status)
);

CREATE TABLE IF NOT EXISTS staff (
    staff_id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id             INT UNSIGNED NOT NULL,
    assigned_service_id INT UNSIGNED NOT NULL,
    staff_role          VARCHAR(80)  NOT NULL,
    created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)             REFERENCES users(user_id)       ON DELETE CASCADE,
    FOREIGN KEY (assigned_service_id) REFERENCES services(service_id) ON DELETE CASCADE
);

-- USERS

INSERT INTO users (username, password_hash, role) VALUES
('admin_reyes',     '$2y$12$3V2K2Fewj4HP/xLh7qcT0uxXXoTn1UF.CKK/WNsMmZhOLixfQ1y/6', 'admin'),
('staff_santos',    '$2y$12$3V2K2Fewj4HP/xLh7qcT0uxXXoTn1UF.CKK/WNsMmZhOLixfQ1y/6', 'staff'),
('staff_dela_cruz', '$2y$12$3V2K2Fewj4HP/xLh7qcT0uxXXoTn1UF.CKK/WNsMmZhOLixfQ1y/6', 'staff'),
('staff_garcia',    '$2y$12$3V2K2Fewj4HP/xLh7qcT0uxXXoTn1UF.CKK/WNsMmZhOLixfQ1y/6', 'staff'),
('staff_mendoza',   '$2y$12$3V2K2Fewj4HP/xLh7qcT0uxXXoTn1UF.CKK/WNsMmZhOLixfQ1y/6', 'staff'),
('juan_dela_cruz',  '$2y$12$3V2K2Fewj4HP/xLh7qcT0uxXXoTn1UF.CKK/WNsMmZhOLixfQ1y/6', 'customer'),
('maria_santos',    '$2y$12$3V2K2Fewj4HP/xLh7qcT0uxXXoTn1UF.CKK/WNsMmZhOLixfQ1y/6', 'customer'),
('carlos_reyes',    '$2y$12$3V2K2Fewj4HP/xLh7qcT0uxXXoTn1UF.CKK/WNsMmZhOLixfQ1y/6', 'customer'),
('ana_lim',         '$2y$12$3V2K2Fewj4HP/xLh7qcT0uxXXoTn1UF.CKK/WNsMmZhOLixfQ1y/6', 'customer'),
('pedro_tan',       '$2y$12$3V2K2Fewj4HP/xLh7qcT0uxXXoTn1UF.CKK/WNsMmZhOLixfQ1y/6', 'customer'),
('liza_flores',     '$2y$12$3V2K2Fewj4HP/xLh7qcT0uxXXoTn1UF.CKK/WNsMmZhOLixfQ1y/6', 'customer'),
('mark_villanueva', '$2y$12$3V2K2Fewj4HP/xLh7qcT0uxXXoTn1UF.CKK/WNsMmZhOLixfQ1y/6', 'customer'),
('rose_aquino',     '$2y$12$3V2K2Fewj4HP/xLh7qcT0uxXXoTn1UF.CKK/WNsMmZhOLixfQ1y/6', 'customer');

-- LOCATIONS (1=Admin Building, 2=CAS Building, 3=CUB)

INSERT INTO locations (building_name) VALUES
('Admin Building'),
('CAS Building'),
('CUB');

-- SERVICES (1=Cash Office, 2=OUR, 3=College Secretary, 4=Guidance Service)

INSERT INTO services (service_name, description, location_id) VALUES
('Cash Office',                        'Tuition payments, fees, and official receipts.',                 1),
('Office of the University Registrar', 'Enrollment, transcript requests, and document authentication.', 1),
('College Secretary',                  'College-level document processing, certifications, and records.',2),
('Guidance Service',                   'Counseling, student wellness, and guidance appointments.',       3);

-- STAFF

INSERT INTO staff (user_id, assigned_service_id, staff_role) VALUES
(1, 1, 'Queue Administrator'),
(2, 2, 'Registrar Clerk'),
(3, 1, 'Cashier'),
(4, 3, 'Secretary Clerk'),
(5, 4, 'Guidance Counselor');

-- QUEUES (today)

INSERT INTO queues (service_id, user_id, queue_number, queue_date, queue_status) VALUES
(1,  6,  1, CURDATE(), 'served'),
(1,  7,  2, CURDATE(), 'served'),
(1,  8,  3, CURDATE(), 'serving'),
(1,  9,  4, CURDATE(), 'waiting'),
(1, 10,  5, CURDATE(), 'waiting'),
(2,  7,  1, CURDATE(), 'served'),
(2, 11,  2, CURDATE(), 'serving'),
(2, 12,  3, CURDATE(), 'waiting'),
(2, 13,  4, CURDATE(), 'waiting'),
(3,  9,  1, CURDATE(), 'served'),
(3, 10,  2, CURDATE(), 'skipped'),
(3,  6,  3, CURDATE(), 'waiting'),
(4, 11,  1, CURDATE(), 'served'),
(4, 12,  2, CURDATE(), 'served'),
(4, 13,  3, CURDATE(), 'serving'),
(4,  8,  4, CURDATE(), 'waiting');

-- QUEUES (yesterday)

INSERT INTO queues (service_id, user_id, queue_number, queue_date, queue_status) VALUES
(1,  9,  1, CURDATE() - INTERVAL 1 DAY, 'served'),
(1, 10,  2, CURDATE() - INTERVAL 1 DAY, 'served'),
(1, 11,  3, CURDATE() - INTERVAL 1 DAY, 'skipped'),
(2,  6,  1, CURDATE() - INTERVAL 1 DAY, 'served'),
(2, 12,  2, CURDATE() - INTERVAL 1 DAY, 'served'),
(3, 13,  1, CURDATE() - INTERVAL 1 DAY, 'served'),
(4,  7,  1, CURDATE() - INTERVAL 1 DAY, 'served'),
(4,  8,  2, CURDATE() - INTERVAL 1 DAY, 'cancelled');
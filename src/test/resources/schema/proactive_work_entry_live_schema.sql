-- Minimal FK fixtures (not full column fidelity — see the test class comment for why) plus the
-- proactive_work_* v1+v2 DDL verbatim from V7__proactive_work_v2.sql, the v3 work_kind column
-- from V10__proactive_work_kind.sql, the v4 Missout categories from
-- V11__proactive_work_missout_categories.sql, and the v5 joint-credit join table from
-- V12__proactive_work_multi_subject.sql.

CREATE TABLE employees (
  id int unsigned NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE kra_area (
  id int unsigned NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE kpi_metric (
  id int unsigned NOT NULL AUTO_INCREMENT,
  kra_area_id int unsigned NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_test_metric_kra FOREIGN KEY (kra_area_id) REFERENCES kra_area (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE kpi_measurement (
  id bigint unsigned NOT NULL AUTO_INCREMENT,
  kpi_metric_id int unsigned NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_test_measurement_metric FOREIGN KEY (kpi_metric_id) REFERENCES kpi_metric (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO kra_area (id) VALUES (1);
INSERT INTO kpi_metric (id, kra_area_id) VALUES (1, 1);
INSERT INTO kpi_measurement (id, kpi_metric_id) VALUES (1, 1);
INSERT INTO employees (id) VALUES (1), (2);

-- ---- proactive_work_entry (v1 + v2 columns), verbatim shape from V7__proactive_work_v2.sql ----

CREATE TABLE `proactive_work_entry` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `kpi_measurement_id` bigint unsigned DEFAULT NULL,
  `entry_type` enum('KPI_LINKED','STANDALONE') GENERATED ALWAYS AS (if((`kpi_measurement_id` is null),_utf8mb4'STANDALONE',_utf8mb4'KPI_LINKED')) STORED NOT NULL,
  `category` enum('ATTENDANCE_PUNCTUALITY','TEAM_SUPPORT','INITIATIVE_IDEA','EXTRA_HOURS','RESOURCE_SAVING','PROCESS_IMPROVEMENT','TECHNICAL_MISSOUT','FUNCTIONAL_MISSOUT','COMMUNICATION_MISSOUT','PROCESS_MISSOUT','TIMELINE_MISSOUT','OTHER') NOT NULL,
  `work_kind` enum('PROACTIVE','MISSOUT') NOT NULL DEFAULT 'PROACTIVE',
  `other_category_text` varchar(300) DEFAULT NULL,
  `subject_employee_id` int unsigned NOT NULL,
  `logged_by_id` int unsigned NOT NULL,
  `title` varchar(200) NOT NULL,
  `description` text NOT NULL,
  `value_statement` varchar(200) DEFAULT NULL,
  `effort_start_date` date NOT NULL,
  `effort_end_date` date NOT NULL,
  `visibility` enum('ORGANISATION','PRIVATE') NOT NULL DEFAULT 'ORGANISATION',
  `is_seen` tinyint(1) NOT NULL DEFAULT '0',
  `seen_at` datetime DEFAULT NULL,
  `seen_by_id` int unsigned DEFAULT NULL,
  `is_highlighted` tinyint(1) NOT NULL DEFAULT '0',
  `highlighted_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `edited_at` datetime DEFAULT NULL,
  `endorsement_count` int unsigned NOT NULL DEFAULT '0',
  `comment_count` int unsigned NOT NULL DEFAULT '0',
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `fk_pwe_seen_by` (`seen_by_id`),
  KEY `idx_subject_date` (`subject_employee_id`,`effort_start_date` DESC),
  KEY `idx_subject_state` (`subject_employee_id`,`is_deleted`,`is_seen`,`is_highlighted`),
  KEY `idx_kpi_measurement` (`kpi_measurement_id`),
  KEY `idx_logged_by` (`logged_by_id`,`created_at`),
  KEY `idx_summary` (`is_deleted`,`subject_employee_id`,`category`),
  KEY `idx_visibility` (`visibility`,`is_deleted`,`effort_start_date` DESC),
  CONSTRAINT `fk_pwe_logged_by` FOREIGN KEY (`logged_by_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_pwe_measurement` FOREIGN KEY (`kpi_measurement_id`) REFERENCES `kpi_measurement` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_pwe_seen_by` FOREIGN KEY (`seen_by_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_pwe_subject` FOREIGN KEY (`subject_employee_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_other_text` CHECK ((((`category` = _utf8mb4'OTHER') and (`other_category_text` is not null) and (trim(`other_category_text`) <> _utf8mb4'')) or ((`category` <> _utf8mb4'OTHER') and (`other_category_text` is null)))),
  CONSTRAINT `chk_period_order` CHECK ((`effort_end_date` >= `effort_start_date`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE proactive_work_entry_subject (
  entry_id    BIGINT UNSIGNED NOT NULL,
  employee_id INT UNSIGNED NOT NULL,
  sort_order  INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (entry_id, employee_id),
  CONSTRAINT fk_pwes_entry FOREIGN KEY (entry_id) REFERENCES proactive_work_entry (id) ON DELETE RESTRICT,
  CONSTRAINT fk_pwes_employee FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE RESTRICT,
  INDEX idx_employee (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `proactive_work_entry_audit` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `entry_id` bigint unsigned NOT NULL,
  `action_type` enum('CREATE','EDIT','SEEN','HIGHLIGHT_ON','HIGHLIGHT_OFF','DELETE','VISIBILITY_CHANGE') NOT NULL,
  `actor_id` int unsigned NOT NULL,
  `changed_fields` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_pwea_actor` (`actor_id`),
  KEY `idx_entry` (`entry_id`,`created_at`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_pwea_actor` FOREIGN KEY (`actor_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_pwea_entry` FOREIGN KEY (`entry_id`) REFERENCES `proactive_work_entry` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE proactive_work_endorsement (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  entry_id            BIGINT UNSIGNED NOT NULL,
  employee_id         INT UNSIGNED NOT NULL,
  subject_employee_id INT UNSIGNED NOT NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  withdrawn_at        DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_entry_employee (entry_id, employee_id),
  CONSTRAINT fk_pwen_entry FOREIGN KEY (entry_id) REFERENCES proactive_work_entry (id) ON DELETE RESTRICT,
  CONSTRAINT fk_pwen_employee FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE RESTRICT,
  CONSTRAINT chk_no_self_endorse CHECK (employee_id <> subject_employee_id),
  INDEX idx_entry_active (entry_id, withdrawn_at),
  INDEX idx_employee (employee_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE proactive_work_comment (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  entry_id   BIGINT UNSIGNED NOT NULL,
  author_id  INT UNSIGNED NOT NULL,
  body       VARCHAR(1000) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  edited_at  DATETIME NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT fk_pwc_entry FOREIGN KEY (entry_id) REFERENCES proactive_work_entry (id) ON DELETE RESTRICT,
  CONSTRAINT fk_pwc_author FOREIGN KEY (author_id) REFERENCES employees (id) ON DELETE RESTRICT,
  CONSTRAINT chk_body_not_blank CHECK (TRIM(body) <> ''),
  INDEX idx_entry (entry_id, is_deleted, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Proactive Work Log v2: peer endorsement + comments, edit-from-detail, Admin Team Summary,
-- value statement field. All additive — every ALTER is nullable/defaulted against a table that
-- already holds rows; the two new tables have no data to migrate.

ALTER TABLE proactive_work_entry
  ADD COLUMN value_statement   VARCHAR(200) NULL AFTER description,
  ADD COLUMN visibility        ENUM('ORGANISATION','PRIVATE')
                                     NOT NULL DEFAULT 'ORGANISATION' AFTER effort_end_date,
  ADD COLUMN edited_at         DATETIME NULL AFTER updated_at,
  ADD COLUMN endorsement_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER edited_at,
  ADD COLUMN comment_count     INT UNSIGNED NOT NULL DEFAULT 0 AFTER endorsement_count,
  ADD INDEX idx_summary    (is_deleted, subject_employee_id, category),
  ADD INDEX idx_visibility (visibility, is_deleted, effort_start_date DESC);

ALTER TABLE proactive_work_entry_audit
  MODIFY COLUMN action_type ENUM('CREATE','EDIT','SEEN','HIGHLIGHT_ON',
                              'HIGHLIGHT_OFF','DELETE',
                              'VISIBILITY_CHANGE') NOT NULL;

CREATE TABLE proactive_work_endorsement (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  entry_id            BIGINT UNSIGNED NOT NULL,
  employee_id         INT UNSIGNED NOT NULL,
  subject_employee_id INT UNSIGNED NOT NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  withdrawn_at        DATETIME NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_entry_employee (entry_id, employee_id),
  CONSTRAINT fk_pwen_entry FOREIGN KEY (entry_id)
    REFERENCES proactive_work_entry (id) ON DELETE RESTRICT,
  CONSTRAINT fk_pwen_employee FOREIGN KEY (employee_id)
    REFERENCES employees (id) ON DELETE RESTRICT,
  CONSTRAINT chk_no_self_endorse CHECK (employee_id <> subject_employee_id),

  INDEX idx_entry_active (entry_id, withdrawn_at),
  INDEX idx_employee     (employee_id, created_at)
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
  CONSTRAINT fk_pwc_entry FOREIGN KEY (entry_id)
    REFERENCES proactive_work_entry (id) ON DELETE RESTRICT,
  CONSTRAINT fk_pwc_author FOREIGN KEY (author_id)
    REFERENCES employees (id) ON DELETE RESTRICT,
  CONSTRAINT chk_body_not_blank CHECK (TRIM(body) <> ''),

  INDEX idx_entry (entry_id, is_deleted, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

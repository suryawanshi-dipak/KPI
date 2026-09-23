-- Proactive Work Log v5: joint credit — a single entry can now name several credited people
-- ("Bhavesh Bhimra & Dipak Suryawanshi") instead of fanning out into one entry per person.
--
-- Additive: proactive_work_entry.subject_employee_id is untouched (existing rows, existing
-- indexes, existing single-subject reads all keep working exactly as before). The new join
-- table adds the full credited set on top of it; the backfill gives every existing row exactly
-- the one subject it already has, in position 0.

CREATE TABLE proactive_work_entry_subject (
  entry_id    BIGINT UNSIGNED NOT NULL,
  employee_id INT UNSIGNED NOT NULL,
  sort_order  INT UNSIGNED NOT NULL DEFAULT 0,

  PRIMARY KEY (entry_id, employee_id),
  CONSTRAINT fk_pwes_entry FOREIGN KEY (entry_id)
    REFERENCES proactive_work_entry (id) ON DELETE RESTRICT,
  CONSTRAINT fk_pwes_employee FOREIGN KEY (employee_id)
    REFERENCES employees (id) ON DELETE RESTRICT,

  INDEX idx_employee (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO proactive_work_entry_subject (entry_id, employee_id, sort_order)
SELECT id, subject_employee_id, 0 FROM proactive_work_entry;

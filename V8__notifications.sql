-- Push notifications for the Proactive Work Log. Three new tables, nothing existing touched.
--
-- One addition beyond the literal design doc: notification_preference.permission_asked_at.
-- The design says "Persist that [permission was asked] server side" but doesn't add a column
-- for it anywhere, and it isn't a "preference" a person set — it's whether we've ever shown
-- them the browser prompt. It belongs next to the other per-employee notification state, and
-- a missing row still means "never asked, defaults apply" exactly as the design intends — the
-- row just gets created (with defaults) the first time permission is requested instead of only
-- when someone changes a setting.

CREATE TABLE push_subscription (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id     INT UNSIGNED NOT NULL,
  endpoint        VARCHAR(500) NOT NULL,
  p256dh          VARCHAR(255) NOT NULL,
  auth            VARCHAR(255) NOT NULL,
  user_agent      VARCHAR(255) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_success_at DATETIME NULL,
  revoked_at      DATETIME NULL,

  PRIMARY KEY (id),
  -- The browser reissues the same endpoint on re-subscribe, so upsert on endpoint rather than
  -- insert — this unique key is what makes that upsert possible.
  UNIQUE KEY uq_push_subscription_endpoint (endpoint),
  KEY idx_push_subscription_employee (employee_id, revoked_at),
  CONSTRAINT fk_push_subscription_employee FOREIGN KEY (employee_id)
    REFERENCES employees (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE notification (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  recipient_id INT UNSIGNED NOT NULL,
  type         ENUM('NEW_ENTRY','LOGGED_FOR_YOU','ENDORSED_YOURS','COMMENTED_YOURS','HIGHLIGHTED_YOURS') NOT NULL,
  entry_id     BIGINT UNSIGNED NOT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at      DATETIME NULL,
  pushed_at    DATETIME NULL,

  PRIMARY KEY (id),
  KEY idx_notification_recipient (recipient_id, created_at DESC),
  -- Backs both digest jobs' "pending" query: pushed_at IS NULL, scoped further by recipient.
  KEY idx_notification_pending (pushed_at, recipient_id),
  KEY idx_notification_entry (entry_id),
  CONSTRAINT fk_notification_recipient FOREIGN KEY (recipient_id)
    REFERENCES employees (id) ON DELETE RESTRICT,
  CONSTRAINT fk_notification_entry FOREIGN KEY (entry_id)
    REFERENCES proactive_work_entry (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE notification_preference (
  employee_id         INT UNSIGNED NOT NULL,
  new_entry_scope     ENUM('EVERYONE','MY_TEAM','NONE') NOT NULL DEFAULT 'EVERYONE',
  delivery            ENUM('INSTANT','HOURLY_DIGEST','DAILY_DIGEST') NOT NULL DEFAULT 'INSTANT',
  own_activity        TINYINT(1) NOT NULL DEFAULT 1,
  highlight           TINYINT(1) NOT NULL DEFAULT 1,
  quiet_from          TIME NULL,
  quiet_to            TIME NULL,
  permission_asked_at DATETIME NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (employee_id),
  CONSTRAINT fk_notification_preference_employee FOREIGN KEY (employee_id)
    REFERENCES employees (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

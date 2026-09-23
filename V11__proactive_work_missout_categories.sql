-- Proactive Work Log v4: five Missout-specific categories, alongside the existing PROACTIVE
-- ones, on the same `category` column. Additive — MODIFY only widens the enum's allowed value
-- set; every existing row's current value stays valid and unchanged.

ALTER TABLE proactive_work_entry
  MODIFY COLUMN category ENUM(
    'ATTENDANCE_PUNCTUALITY','TEAM_SUPPORT','INITIATIVE_IDEA','EXTRA_HOURS',
    'RESOURCE_SAVING','PROCESS_IMPROVEMENT',
    'TECHNICAL_MISSOUT','FUNCTIONAL_MISSOUT','COMMUNICATION_MISSOUT',
    'PROCESS_MISSOUT','TIMELINE_MISSOUT',
    'OTHER'
  ) NOT NULL;



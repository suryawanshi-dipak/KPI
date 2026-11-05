-- KPI-29: Proactive Work Log v5 — Add Achievements type and KRA achievement categories
-- Expands work_kind to include 'ACHIEVEMENT' for logging core responsibility / KRA fulfillment.
-- Expands category with achievement-specific categories alongside PROACTIVE and MISSOUT.
-- Additive: MODIFY only widens the enum allowed value sets; pre-existing rows remain valid and unchanged.

ALTER TABLE proactive_work_entry
  MODIFY COLUMN work_kind ENUM('PROACTIVE','MISSOUT','ACHIEVEMENT') NOT NULL DEFAULT 'PROACTIVE';

ALTER TABLE proactive_work_entry
  MODIFY COLUMN category ENUM(
    'ATTENDANCE_PUNCTUALITY','TEAM_SUPPORT','INITIATIVE_IDEA','EXTRA_HOURS',
    'RESOURCE_SAVING','PROCESS_IMPROVEMENT',
    'TECHNICAL_MISSOUT','FUNCTIONAL_MISSOUT','COMMUNICATION_MISSOUT',
    'PROCESS_MISSOUT','TIMELINE_MISSOUT',
    'KRA_DELIVERY','MILESTONE_ACHIEVED','QUALITY_STANDARDS','OPERATIONAL_EXCELLENCE',
    'OTHER'
  ) NOT NULL;


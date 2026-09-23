-- Proactive Work Log v3: distinguish logged effort worth crediting (PROACTIVE) from a
-- self-reported shortfall (MISSOUT). Additive — NOT NULL DEFAULT 'PROACTIVE' against a table
-- that already holds rows, so every existing entry reads as PROACTIVE with no backfill step.

ALTER TABLE proactive_work_entry
  ADD COLUMN work_kind ENUM('PROACTIVE','MISSOUT') NOT NULL DEFAULT 'PROACTIVE' AFTER category;

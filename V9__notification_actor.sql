-- Adds actor attribution to `notification` so the bell feed can correctly say WHO did something,
-- not just which entry it happened on.
--
-- V8 only needed entry_id because, for NEW_ENTRY/LOGGED_FOR_YOU, the actor is always the entry's
-- own logged_by_id, so the original design didn't store it separately. Wiring endorsement/comment/
-- highlight notifications (ENDORSED_YOURS/COMMENTED_YOURS/HIGHLIGHTED_YOURS) breaks that
-- assumption: the person who endorses, comments on, or highlights an entry is a third party, not
-- the entry's logger, and there is no other way to recover who that was once the notification is
-- rendered later. actor_id is nullable and ON DELETE SET NULL (rather than RESTRICT, like the
-- other FKs here) because losing attribution on an old notification is acceptable; blocking an
-- employee record's deletion just because they once endorsed something is not.

ALTER TABLE notification
  ADD COLUMN actor_id INT UNSIGNED NULL AFTER recipient_id,
  ADD CONSTRAINT fk_notification_actor FOREIGN KEY (actor_id)
    REFERENCES employees (id) ON DELETE SET NULL;

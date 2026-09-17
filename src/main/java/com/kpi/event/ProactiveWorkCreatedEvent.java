package com.kpi.event;

/**
 * Emitted within the transaction that saves a ProactiveWorkEntry.
 * Handled exclusively AFTER_COMMIT so rolled-back saves notify nobody.
 */
public record ProactiveWorkCreatedEvent(Long entryId) {}

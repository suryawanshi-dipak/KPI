package com.kpi.event;

import com.kpi.entity.enums.NotificationType;

/**
 * Emitted when someone engages with an existing entry — endorse, comment, or highlight —
 * as opposed to {@link ProactiveWorkCreatedEvent}, which is entry creation itself. The actor is
 * whoever performed the action, which is why it has to travel separately from the entry: for
 * these three types the actor is a third party, never the entry's own logger.
 */
public record ProactiveWorkActivityEvent(Long entryId, NotificationType type, Integer actorId) {
}

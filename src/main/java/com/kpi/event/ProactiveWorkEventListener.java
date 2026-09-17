package com.kpi.event;

import com.kpi.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Dispatches notification fan-out after successful database commit.
 * Running asynchronously ensures zero push overhead inside the HTTP request thread.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ProactiveWorkEventListener {

    private final NotificationService notificationService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async("notificationExecutor")
    public void onProactiveWorkCreated(ProactiveWorkCreatedEvent event) {
        try {
            notificationService.fanOutForEntry(event.entryId());
        } catch (Exception e) {
            log.error("Unexpected error during proactive work notification fan-out for entry {}: {}",
                    event.entryId(), e.getMessage(), e);
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Async("notificationExecutor")
    public void onProactiveWorkActivity(ProactiveWorkActivityEvent event) {
        try {
            notificationService.notifyActivity(event.entryId(), event.type(), event.actorId());
        } catch (Exception e) {
            log.error("Unexpected error during proactive work activity notification for entry {} ({}): {}",
                    event.entryId(), event.type(), e.getMessage(), e);
        }
    }
}

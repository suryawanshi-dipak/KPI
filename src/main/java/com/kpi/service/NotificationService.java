package com.kpi.service;

import com.kpi.dto.request.NotificationPreferenceRequest;
import com.kpi.dto.response.NotificationPreferenceResponse;
import com.kpi.dto.response.NotificationResponse;
import com.kpi.entity.ProactiveWorkEntry;
import com.kpi.entity.enums.NotificationType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;

public interface NotificationService {

    record RecipientDelivery(Integer recipientId, NotificationType type, boolean eligibleForImmediatePush) {}

    /**
     * Recipient resolution containing the complete business logic in strict sequence:
     * 1. Visibility (PRIVATE -> subject or manager only, never org broadcast).
     * 2. Subject and logger exclusion (never notify logger or subject on broadcast; LOGGED_FOR_YOU when logged on behalf).
     * 3. Candidate's new_entry_scope (NONE drops, MY_TEAM checks team membership, EVERYONE retains).
     * 4. Quiet hours and delivery timing (suppresses immediate push, leaves notification row for digest sweep).
     */
    List<RecipientDelivery> resolveRecipients(ProactiveWorkEntry entry, LocalDateTime now);

    void fanOutForEntry(Long entryId);

    /** Single-recipient path for endorse/comment/highlight: always the entry's subject, gated by
     *  own_activity (ENDORSED_YOURS/COMMENTED_YOURS) or highlight (HIGHLIGHTED_YOURS), never a scope fan-out. */
    void notifyActivity(Long entryId, NotificationType type, Integer actorId);

    void runHourlyDigest();

    void runDailyDigest();

    Page<NotificationResponse> getBellFeed(Integer employeeId, Pageable pageable);

    long getUnreadCount(Integer employeeId);

    void markRead(Long notificationId, Integer employeeId);

    void markAllRead(Integer employeeId);

    NotificationPreferenceResponse getPreferences(Integer employeeId);

    NotificationPreferenceResponse updatePreferences(Integer employeeId, NotificationPreferenceRequest request);

    void recordPermissionAsked(Integer employeeId);
}

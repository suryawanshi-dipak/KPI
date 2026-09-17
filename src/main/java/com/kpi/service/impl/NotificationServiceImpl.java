package com.kpi.service.impl;

import com.kpi.dto.request.NotificationPreferenceRequest;
import com.kpi.dto.response.NotificationPreferenceResponse;
import com.kpi.dto.response.NotificationResponse;
import com.kpi.entity.Employee;
import com.kpi.entity.Notification;
import com.kpi.entity.NotificationPreference;
import com.kpi.entity.PushSubscription;
import com.kpi.entity.ProactiveWorkEntry;
import com.kpi.entity.enums.DeliveryFrequency;
import com.kpi.entity.enums.NewEntryScope;
import com.kpi.entity.enums.NotificationType;
import com.kpi.entity.enums.ProactiveWorkVisibility;
import com.kpi.repository.EmployeeRepository;
import com.kpi.repository.NotificationPreferenceRepository;
import com.kpi.repository.NotificationRepository;
import com.kpi.repository.ProactiveWorkEntryRepository;
import com.kpi.service.NotificationFormatter;
import com.kpi.service.NotificationService;
import com.kpi.service.PushSubscriptionService;
import com.kpi.webpush.WebPushSender;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.sql.DataSource;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationServiceImpl implements NotificationService {

    private final NotificationRepository notificationRepository;
    private final NotificationPreferenceRepository preferenceRepository;
    private final PushSubscriptionService subscriptionService;
    private final ProactiveWorkEntryRepository entryRepository;
    private final EmployeeRepository employeeRepository;
    private final WebPushSender webPushSender;
    private final NotificationFormatter formatter;
    private final DataSource dataSource;

    @Override
    public List<RecipientDelivery> resolveRecipients(ProactiveWorkEntry entry, LocalDateTime now) {
        List<RecipientDelivery> result = new ArrayList<>();
        LocalTime nowTime = now.toLocalTime();

        // Loaded once, with `manager` eagerly fetched: this method is called from the
        // non-transactional, async fanOutForEntry (self-invocation means a class-level
        // @Transactional here would be silently skipped by Spring's proxy anyway), so any
        // lazy Employee.manager proxy handed back by a plain findAll() would blow up with
        // LazyInitializationException the moment isSameTeam() touches it below.
        List<Employee> allEmployees = employeeRepository.findAllWithManager();
        Map<Integer, Employee> employeesById = new HashMap<>();
        for (Employee e : allEmployees) {
            employeesById.put(e.getId(), e);
        }
        Map<Integer, NotificationPreference> preferencesById = loadPreferences(employeesById.keySet());

        // 1. VISIBILITY FIRST
        if (entry.getVisibility() == ProactiveWorkVisibility.PRIVATE) {
            boolean loggedOnBehalf = !entry.getLoggedById().equals(entry.getSubjectEmployeeId());
            if (loggedOnBehalf) {
                // Manager logged on behalf of employee -> notify subject with LOGGED_FOR_YOU,
                // gated by the subject's own_activity preference like every other
                // activity-on-my-entry notification.
                Integer subjectId = entry.getSubjectEmployeeId();
                NotificationPreference pref = preferenceOrDefaults(preferencesById, subjectId);
                if (Boolean.TRUE.equals(pref.getOwnActivity())) {
                    boolean immediate = isImmediateEligible(pref, nowTime);
                    result.add(new RecipientDelivery(subjectId, NotificationType.LOGGED_FOR_YOU, immediate));
                }
            } else {
                // Employee logged private entry for self -> notify subject's manager with
                // NEW_ENTRY, unless that manager has opted out of new-entry notifications entirely.
                Employee subject = employeesById.get(entry.getSubjectEmployeeId());
                if (subject != null && subject.getManager() != null) {
                    Integer managerId = subject.getManager().getId();
                    if (!managerId.equals(entry.getLoggedById())) {
                        NotificationPreference pref = preferenceOrDefaults(preferencesById, managerId);
                        NewEntryScope scope = pref.getNewEntryScope() != null ? pref.getNewEntryScope() : NewEntryScope.EVERYONE;
                        if (scope != NewEntryScope.NONE) {
                            boolean immediate = isImmediateEligible(pref, nowTime);
                            result.add(new RecipientDelivery(managerId, NotificationType.NEW_ENTRY, immediate));
                        }
                    }
                }
            }
            return result; // PRIVATE entries never broadcast org-wide
        }

        // 2. SUBJECT AND LOGGER EXCLUSION (for ORGANISATION visibility)
        boolean loggedOnBehalf = !entry.getLoggedById().equals(entry.getSubjectEmployeeId());
        if (loggedOnBehalf) {
            Integer subjectId = entry.getSubjectEmployeeId();
            NotificationPreference pref = preferenceOrDefaults(preferencesById, subjectId);
            if (Boolean.TRUE.equals(pref.getOwnActivity())) {
                boolean immediate = isImmediateEligible(pref, nowTime);
                result.add(new RecipientDelivery(subjectId, NotificationType.LOGGED_FOR_YOU, immediate));
            }
        }

        Employee subjectEmployee = employeesById.get(entry.getSubjectEmployeeId());

        for (Employee candidate : allEmployees) {
            Integer candId = candidate.getId();

            // Never notify the logger
            if (candId.equals(entry.getLoggedById())) {
                continue;
            }
            // Never notify the subject with standard NEW_ENTRY broadcast
            if (candId.equals(entry.getSubjectEmployeeId())) {
                continue;
            }

            // 3. CANDIDATE'S NEW_ENTRY_SCOPE PREFERENCE
            NotificationPreference pref = preferenceOrDefaults(preferencesById, candId);
            NewEntryScope scope = pref.getNewEntryScope() != null ? pref.getNewEntryScope() : NewEntryScope.EVERYONE;

            if (scope == NewEntryScope.NONE) {
                continue;
            }

            if (scope == NewEntryScope.MY_TEAM) {
                if (!isSameTeam(candidate, subjectEmployee)) {
                    continue;
                }
            }

            // 4. QUIET HOURS AND DELIVERY TIMING
            boolean immediate = isImmediateEligible(pref, nowTime);
            result.add(new RecipientDelivery(candId, NotificationType.NEW_ENTRY, immediate));
        }

        return result;
    }

    private Map<Integer, NotificationPreference> loadPreferences(Iterable<Integer> employeeIds) {
        List<Integer> ids = new ArrayList<>();
        employeeIds.forEach(ids::add);
        Map<Integer, NotificationPreference> byId = new HashMap<>();
        for (NotificationPreference pref : preferenceRepository.findAllById(ids)) {
            byId.put(pref.getEmployeeId(), pref);
        }
        return byId;
    }

    private NotificationPreference preferenceOrDefaults(Map<Integer, NotificationPreference> preferencesById, Integer employeeId) {
        NotificationPreference pref = preferencesById.get(employeeId);
        return pref != null ? pref : defaultPreference(employeeId);
    }

    private boolean isSameTeam(Employee a, Employee b) {
        if (a == null || b == null) return false;
        if (a.getId().equals(b.getId())) return true;
        if (b.getManager() != null && a.getId().equals(b.getManager().getId())) return true;
        if (a.getManager() != null && b.getId().equals(a.getManager().getId())) return true;
        if (a.getManager() != null && b.getManager() != null && a.getManager().getId().equals(b.getManager().getId())) return true;
        if (a.getTeamId() != null && b.getTeamId() != null && a.getTeamId().equals(b.getTeamId())) return true;
        if (a.getDepartment() != null && b.getDepartment() != null && a.getDepartment().equalsIgnoreCase(b.getDepartment())) return true;
        return false;
    }

    private boolean isImmediateEligible(NotificationPreference pref, LocalTime nowTime) {
        if (pref.getDelivery() != null && pref.getDelivery() != DeliveryFrequency.INSTANT) {
            return false;
        }
        return !isCurrentlyQuiet(pref, nowTime);
    }

    /** Null quiet_from/quiet_to means "never quiet" — callers must not call isInQuietHours directly with possibly-null bounds. */
    private boolean isCurrentlyQuiet(NotificationPreference pref, LocalTime nowTime) {
        if (pref.getQuietFrom() == null || pref.getQuietTo() == null) {
            return false;
        }
        return isInQuietHours(nowTime, pref.getQuietFrom(), pref.getQuietTo());
    }

    private boolean isInQuietHours(LocalTime current, LocalTime from, LocalTime to) {
        if (from.equals(to)) return false;
        if (from.isBefore(to)) {
            return !current.isBefore(from) && current.isBefore(to);
        } else {
            return !current.isBefore(from) || current.isBefore(to);
        }
    }

    @Override
    public void fanOutForEntry(Long entryId) {
        ProactiveWorkEntry entry = entryRepository.findById(entryId).orElse(null);
        if (entry == null || Boolean.TRUE.equals(entry.getIsDeleted())) {
            return;
        }

        Employee loggedBy = employeeRepository.findById(entry.getLoggedById()).orElse(null);
        LocalDateTime now = LocalDateTime.now();
        List<RecipientDelivery> recipients = resolveRecipients(entry, now);

        List<Notification> notificationsToSave = new ArrayList<>();
        for (RecipientDelivery rd : recipients) {
            Notification n = Notification.builder()
                    .recipientId(rd.recipientId())
                    .actorId(entry.getLoggedById())
                    .type(rd.type())
                    .entryId(entryId)
                    .createdAt(now)
                    .pushedAt(null)
                    .build();
            notificationsToSave.add(n);
        }
        List<Notification> savedNotifications = notificationRepository.saveAll(notificationsToSave);

        for (int i = 0; i < recipients.size(); i++) {
            RecipientDelivery rd = recipients.get(i);
            if (!rd.eligibleForImmediatePush()) {
                continue;
            }
            Notification notif = savedNotifications.get(i);
            List<PushSubscription> subscriptions = subscriptionService.getActiveSubscriptions(rd.recipientId());
            if (subscriptions.isEmpty()) {
                continue;
            }

            String title = formatter.formatTitle(rd.type(), loggedBy);
            String body = formatter.formatBody(entry);
            String url = formatter.formatEntryUrl(entryId);
            String pushPayload = formatter.buildPushJson(title, body, url, entryId, true);

            boolean anySuccess = false;
            for (PushSubscription sub : subscriptions) {
                WebPushSender.Outcome outcome = webPushSender.send(sub, pushPayload);
                if (outcome == WebPushSender.Outcome.SUCCESS) {
                    anySuccess = true;
                    subscriptionService.markSuccess(sub.getEndpoint());
                } else if (outcome == WebPushSender.Outcome.GONE) {
                    subscriptionService.revoke(sub.getEndpoint());
                }
            }

            if (anySuccess) {
                notif.setPushedAt(LocalDateTime.now());
                notificationRepository.save(notif);
            }
        }
    }

    @Override
    public void notifyActivity(Long entryId, NotificationType type, Integer actorId) {
        ProactiveWorkEntry entry = entryRepository.findById(entryId).orElse(null);
        if (entry == null || Boolean.TRUE.equals(entry.getIsDeleted())) {
            return;
        }
        Integer recipientId = entry.getSubjectEmployeeId();
        // No self-notification: an admin highlighting their own entry, or (defensively, even
        // though the endorse/comment paths already forbid self-targeting) any other case where
        // the actor and the subject are the same person.
        if (recipientId.equals(actorId)) {
            return;
        }

        NotificationPreference pref = getPreferenceOrDefaults(recipientId);
        boolean wanted = type == NotificationType.HIGHLIGHTED_YOURS
                ? Boolean.TRUE.equals(pref.getHighlight())
                : Boolean.TRUE.equals(pref.getOwnActivity());
        if (!wanted) {
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        Notification notif = Notification.builder()
                .recipientId(recipientId)
                .actorId(actorId)
                .type(type)
                .entryId(entryId)
                .createdAt(now)
                .pushedAt(null)
                .build();
        notif = notificationRepository.save(notif);

        if (!isImmediateEligible(pref, now.toLocalTime())) {
            return; // row stays pending for the next digest sweep
        }
        List<PushSubscription> subscriptions = subscriptionService.getActiveSubscriptions(recipientId);
        if (subscriptions.isEmpty()) {
            return;
        }

        Employee actor = employeeRepository.findById(actorId).orElse(null);
        String title = formatter.formatTitle(type, actor);
        String body = formatter.formatBody(entry);
        String url = formatter.formatEntryUrl(entryId);
        String pushPayload = formatter.buildPushJson(title, body, url, entryId, true);

        boolean anySuccess = false;
        for (PushSubscription sub : subscriptions) {
            WebPushSender.Outcome outcome = webPushSender.send(sub, pushPayload);
            if (outcome == WebPushSender.Outcome.SUCCESS) {
                anySuccess = true;
                subscriptionService.markSuccess(sub.getEndpoint());
            } else if (outcome == WebPushSender.Outcome.GONE) {
                subscriptionService.revoke(sub.getEndpoint());
            }
        }
        if (anySuccess) {
            notif.setPushedAt(LocalDateTime.now());
            notificationRepository.save(notif);
        }
    }

    @Override
    @Scheduled(cron = "0 0 * * * *")
    public void runHourlyDigest() {
        executeDigestSweep(false);
    }

    @Override
    @Scheduled(cron = "0 0 17 * * *")
    public void runDailyDigest() {
        executeDigestSweep(true);
    }

    private void executeDigestSweep(boolean isDaily) {
        // MySQL's GET_LOCK()/RELEASE_LOCK() are scoped to the *session* (the physical
        // connection), not to the query. JdbcTemplate borrows a connection from the HikariCP
        // pool per call and returns it immediately after — so a GET_LOCK via jdbcTemplate and a
        // later RELEASE_LOCK via jdbcTemplate can (and in practice regularly do) run on two
        // different pooled connections. When that happens RELEASE_LOCK silently does nothing
        // (it only releases a lock held by the caller's own session), the lock is never
        // released, and every subsequent scheduled run finds it already held and skips forever
        // — with nothing but a debug log to show for it. Holding one JDBC Connection for the
        // whole acquire/work/release sequence is what makes GET_LOCK and RELEASE_LOCK agree on
        // which session holds the lock.
        try (java.sql.Connection lockConnection = dataSource.getConnection()) {
            boolean acquired;
            try (java.sql.Statement stmt = lockConnection.createStatement();
                 java.sql.ResultSet rs = stmt.executeQuery("SELECT GET_LOCK('kpi_push_digest_lock', 0)")) {
                acquired = rs.next() && rs.getInt(1) == 1;
            }
            if (!acquired) {
                log.debug("Another instance holds kpi_push_digest_lock; skipping digest sweep.");
                return;
            }
            try {
                runDigestSweepBody(isDaily);
            } finally {
                try (java.sql.Statement stmt = lockConnection.createStatement()) {
                    stmt.execute("SELECT RELEASE_LOCK('kpi_push_digest_lock')");
                } catch (Exception e) {
                    log.warn("Error releasing kpi_push_digest_lock: {}", e.getMessage());
                }
            }
        } catch (Exception e) {
            log.warn("Could not acquire named lock for digest job: {}", e.getMessage());
        }
    }

    private void runDigestSweepBody(boolean isDaily) {
        LocalDateTime now = LocalDateTime.now();
            LocalTime nowTime = now.toLocalTime();
            List<Integer> recipientIds = notificationRepository.findDistinctRecipientIdsWithPendingPush();

            for (Integer recipientId : recipientIds) {
                NotificationPreference pref = getPreferenceOrDefaults(recipientId);
                DeliveryFrequency delivery = pref.getDelivery() != null ? pref.getDelivery() : DeliveryFrequency.INSTANT;

                // The daily job is the one guaranteed once-a-day touchpoint for DAILY_DIGEST
                // recipients, so — unlike the other two branches — it is never suppressed by
                // quiet hours; otherwise someone whose quiet hours happen to span 17:00 would
                // never receive a digest at all. INSTANT recipients are swept here only by the
                // hourly job (this is their failed-immediate-push / no-subscription-yet
                // catch-up path); the daily job intentionally leaves their pending rows alone.
                boolean shouldSend;
                if (isDaily) {
                    shouldSend = delivery == DeliveryFrequency.DAILY_DIGEST;
                } else if (delivery == DeliveryFrequency.HOURLY_DIGEST || delivery == DeliveryFrequency.INSTANT) {
                    shouldSend = !isCurrentlyQuiet(pref, nowTime);
                } else {
                    shouldSend = false;
                }

                if (!shouldSend) {
                    continue;
                }

                List<Notification> pending = notificationRepository.findByRecipientIdAndPushedAtIsNull(recipientId);
                if (pending.isEmpty()) {
                    continue;
                }

                List<PushSubscription> subs = subscriptionService.getActiveSubscriptions(recipientId);
                if (!subs.isEmpty()) {
                    long count = pending.size();
                    String title = formatter.formatDigestTitle(isDaily);
                    String body = formatter.formatDigestBody(count, isDaily);
                    String url = formatter.formatDigestUrl();
                    String payload = formatter.buildPushJson(title, body, url, null, false);

                    for (PushSubscription sub : subs) {
                        WebPushSender.Outcome outcome = webPushSender.send(sub, payload);
                        if (outcome == WebPushSender.Outcome.SUCCESS) {
                            subscriptionService.markSuccess(sub.getEndpoint());
                        } else if (outcome == WebPushSender.Outcome.GONE) {
                            subscriptionService.revoke(sub.getEndpoint());
                        }
                    }
                }

                LocalDateTime pushedNow = LocalDateTime.now();
                for (Notification n : pending) {
                    n.setPushedAt(pushedNow);
                }
                notificationRepository.saveAll(pending);
            }
    }

    @Override
    @Transactional(readOnly = true)
    public Page<NotificationResponse> getBellFeed(Integer employeeId, Pageable pageable) {
        Page<Notification> page = notificationRepository.findByRecipientIdOrderByCreatedAtDesc(employeeId, pageable);
        return page.map(n -> {
            ProactiveWorkEntry entry = entryRepository.findById(n.getEntryId()).orElse(null);
            // actorId is who actually did the thing (endorsed/commented/highlighted/logged);
            // fall back to the entry's logger only for rows written before actor_id existed.
            Integer actorId = n.getActorId() != null ? n.getActorId() : (entry != null ? entry.getLoggedById() : null);
            Employee actor = actorId != null ? employeeRepository.findById(actorId).orElse(null) : null;
            String title = formatter.formatTitle(n.getType(), actor);
            String body = entry != null ? formatter.formatBody(entry) : "Proactive work entry";
            String url = formatter.formatEntryUrl(n.getEntryId());
            return NotificationResponse.builder()
                    .id(n.getId())
                    .recipientId(n.getRecipientId())
                    .type(n.getType())
                    .entryId(n.getEntryId())
                    .title(title)
                    .body(body)
                    .url(url)
                    .createdAt(n.getCreatedAt())
                    .readAt(n.getReadAt())
                    .pushedAt(n.getPushedAt())
                    .build();
        });
    }

    @Override
    @Transactional(readOnly = true)
    public long getUnreadCount(Integer employeeId) {
        return notificationRepository.countByRecipientIdAndReadAtIsNull(employeeId);
    }

    @Override
    @Transactional
    public void markRead(Long notificationId, Integer employeeId) {
        notificationRepository.findById(notificationId).ifPresent(n -> {
            if (n.getRecipientId().equals(employeeId) && n.getReadAt() == null) {
                n.setReadAt(LocalDateTime.now());
                notificationRepository.save(n);
            }
        });
    }

    @Override
    @Transactional
    public void markAllRead(Integer employeeId) {
        notificationRepository.markAllRead(employeeId, LocalDateTime.now());
    }

    @Override
    @Transactional(readOnly = true)
    public NotificationPreferenceResponse getPreferences(Integer employeeId) {
        NotificationPreference pref = getPreferenceOrDefaults(employeeId);
        return toPreferenceResponse(pref);
    }

    @Override
    @Transactional
    public NotificationPreferenceResponse updatePreferences(Integer employeeId, NotificationPreferenceRequest request) {
        NotificationPreference pref = preferenceRepository.findById(employeeId).orElse(null);
        if (pref == null) {
            pref = NotificationPreference.builder()
                    .employeeId(employeeId)
                    .newEntryScope(request.getNewEntryScope() != null ? request.getNewEntryScope() : NewEntryScope.EVERYONE)
                    .delivery(request.getDelivery() != null ? request.getDelivery() : DeliveryFrequency.INSTANT)
                    .ownActivity(request.getOwnActivity() != null ? request.getOwnActivity() : true)
                    .highlight(request.getHighlight() != null ? request.getHighlight() : true)
                    .quietFrom(request.getQuietFrom())
                    .quietTo(request.getQuietTo())
                    .build();
        } else {
            if (request.getNewEntryScope() != null) pref.setNewEntryScope(request.getNewEntryScope());
            if (request.getDelivery() != null) pref.setDelivery(request.getDelivery());
            if (request.getOwnActivity() != null) pref.setOwnActivity(request.getOwnActivity());
            if (request.getHighlight() != null) pref.setHighlight(request.getHighlight());
            pref.setQuietFrom(request.getQuietFrom());
            pref.setQuietTo(request.getQuietTo());
        }
        return toPreferenceResponse(preferenceRepository.save(pref));
    }

    @Override
    @Transactional
    public void recordPermissionAsked(Integer employeeId) {
        NotificationPreference pref = preferenceRepository.findById(employeeId).orElse(null);
        if (pref == null) {
            pref = NotificationPreference.builder()
                    .employeeId(employeeId)
                    .permissionAskedAt(LocalDateTime.now())
                    .build();
        } else {
            if (pref.getPermissionAskedAt() == null) {
                pref.setPermissionAskedAt(LocalDateTime.now());
            }
        }
        preferenceRepository.save(pref);
    }

    private NotificationPreference getPreferenceOrDefaults(Integer employeeId) {
        return preferenceRepository.findById(employeeId).orElseGet(() -> defaultPreference(employeeId));
    }

    /** A missing row means every default applies — see NotificationPreference's own javadoc. */
    private NotificationPreference defaultPreference(Integer employeeId) {
        return NotificationPreference.builder()
                .employeeId(employeeId)
                .newEntryScope(NewEntryScope.EVERYONE)
                .delivery(DeliveryFrequency.INSTANT)
                .ownActivity(true)
                .highlight(true)
                .build();
    }

    private NotificationPreferenceResponse toPreferenceResponse(NotificationPreference p) {
        return NotificationPreferenceResponse.builder()
                .employeeId(p.getEmployeeId())
                .newEntryScope(p.getNewEntryScope())
                .delivery(p.getDelivery())
                .ownActivity(p.getOwnActivity())
                .highlight(p.getHighlight())
                .quietFrom(p.getQuietFrom())
                .quietTo(p.getQuietTo())
                .permissionAskedAt(p.getPermissionAskedAt())
                .permissionAsked(p.getPermissionAskedAt() != null)
                .build();
    }
}

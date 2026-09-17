package com.kpi.service.impl;

import com.kpi.entity.Notification;
import com.kpi.entity.NotificationPreference;
import com.kpi.entity.ProactiveWorkEntry;
import com.kpi.entity.PushSubscription;
import com.kpi.entity.enums.DeliveryFrequency;
import com.kpi.entity.enums.NotificationType;
import com.kpi.repository.EmployeeRepository;
import com.kpi.repository.NotificationPreferenceRepository;
import com.kpi.repository.NotificationRepository;
import com.kpi.repository.ProactiveWorkEntryRepository;
import com.kpi.service.NotificationFormatter;
import com.kpi.service.PushSubscriptionService;
import com.kpi.webpush.WebPushSender;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.*;

/**
 * Regression coverage for the digest sweep's "catch-up" job: an INSTANT-preference recipient
 * whose immediate push failed (or had no subscription yet) at entry-creation time must still
 * get delivered by the next hourly sweep, even if they never configured quiet hours — quiet
 * hours are optional, so the sweep can't require them to be set before it will ever retry.
 */
class NotificationDigestSweepTest {

    @Mock private NotificationRepository notificationRepository;
    @Mock private NotificationPreferenceRepository preferenceRepository;
    @Mock private PushSubscriptionService subscriptionService;
    @Mock private ProactiveWorkEntryRepository entryRepository;
    @Mock private EmployeeRepository employeeRepository;
    @Mock private WebPushSender webPushSender;
    @Mock private NotificationFormatter formatter;
    @Mock private DataSource dataSource;
    @Mock private Connection connection;
    @Mock private Statement statement;
    @Mock private ResultSet resultSet;

    private NotificationServiceImpl service;

    @BeforeEach
    void setUp() throws Exception {
        MockitoAnnotations.openMocks(this);
        service = new NotificationServiceImpl(
                notificationRepository, preferenceRepository, subscriptionService,
                entryRepository, employeeRepository, webPushSender, formatter, dataSource);
        // GET_LOCK/RELEASE_LOCK must run on the same java.sql.Connection — see the comment on
        // NotificationServiceImpl.executeDigestSweep for why a per-call JdbcTemplate can't do this.
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.createStatement()).thenReturn(statement);
        when(statement.executeQuery(startsWith("SELECT GET_LOCK"))).thenReturn(resultSet);
        when(resultSet.next()).thenReturn(true);
        when(resultSet.getInt(1)).thenReturn(1);
    }

    @Test
    void hourlySweepDeliversInstantUsersPendingRowsEvenWithoutQuietHoursConfigured() {
        Integer recipientId = 9;
        NotificationPreference pref = NotificationPreference.builder()
                .employeeId(recipientId)
                .delivery(DeliveryFrequency.INSTANT)
                .quietFrom(null)
                .quietTo(null)
                .build();
        when(notificationRepository.findDistinctRecipientIdsWithPendingPush()).thenReturn(List.of(recipientId));
        when(preferenceRepository.findById(recipientId)).thenReturn(Optional.of(pref));

        Notification pending = Notification.builder().id(1L).recipientId(recipientId).build();
        when(notificationRepository.findByRecipientIdAndPushedAtIsNull(recipientId)).thenReturn(List.of(pending));

        PushSubscription sub = PushSubscription.builder().id(1L).employeeId(recipientId)
                .endpoint("https://push.example/1").p256dh("k").auth("a").build();
        when(subscriptionService.getActiveSubscriptions(recipientId)).thenReturn(List.of(sub));
        when(formatter.formatDigestTitle(false)).thenReturn("Proactive Work Hourly Digest");
        when(formatter.formatDigestBody(anyLong(), eq(false))).thenReturn("1 new proactive work entries logged this hour.");
        when(formatter.formatDigestUrl()).thenReturn("/proactive-work");
        when(formatter.buildPushJson(anyString(), anyString(), anyString(), isNull(), eq(false))).thenReturn("{\"title\":\"x\"}");
        when(webPushSender.send(eq(sub), anyString())).thenReturn(WebPushSender.Outcome.SUCCESS);

        service.runHourlyDigest();

        // The whole point of the catch-up path: it must actually attempt delivery, and mark the
        // row pushed on success, instead of leaving it stuck forever because no quiet hours exist.
        verify(webPushSender).send(eq(sub), anyString());
        verify(notificationRepository).saveAll(List.of(pending));
        assert pending.getPushedAt() != null : "pending row should be marked pushed after a successful catch-up send";
    }

    @Test
    void hourlySweepSkipsRecipientWithNoPendingNotifications() {
        when(notificationRepository.findDistinctRecipientIdsWithPendingPush()).thenReturn(List.of());

        service.runHourlyDigest();

        verifyNoInteractions(webPushSender);
    }

    @Test
    void notifyActivity_endorsement_notifiesSubjectWhenOwnActivityEnabled() {
        ProactiveWorkEntry entry = ProactiveWorkEntry.builder().id(50L).subjectEmployeeId(7).loggedById(7).isDeleted(false).build();
        when(entryRepository.findById(50L)).thenReturn(Optional.of(entry));
        NotificationPreference pref = NotificationPreference.builder().employeeId(7).ownActivity(true).build();
        when(preferenceRepository.findById(7)).thenReturn(Optional.of(pref));
        when(subscriptionService.getActiveSubscriptions(7)).thenReturn(List.of());

        service.notifyActivity(50L, NotificationType.ENDORSED_YOURS, 99);

        verify(notificationRepository).save(argThat(n ->
                n.getRecipientId().equals(7) && n.getActorId().equals(99) && n.getType() == NotificationType.ENDORSED_YOURS));
    }

    @Test
    void notifyActivity_skipsWhenOwnActivityDisabled() {
        ProactiveWorkEntry entry = ProactiveWorkEntry.builder().id(51L).subjectEmployeeId(7).loggedById(7).isDeleted(false).build();
        when(entryRepository.findById(51L)).thenReturn(Optional.of(entry));
        NotificationPreference pref = NotificationPreference.builder().employeeId(7).ownActivity(false).build();
        when(preferenceRepository.findById(7)).thenReturn(Optional.of(pref));

        service.notifyActivity(51L, NotificationType.COMMENTED_YOURS, 99);

        verify(notificationRepository, never()).save(any(Notification.class));
    }

    @Test
    void notifyActivity_highlightGatedByHighlightPreferenceNotOwnActivity() {
        ProactiveWorkEntry entry = ProactiveWorkEntry.builder().id(52L).subjectEmployeeId(7).loggedById(7).isDeleted(false).build();
        when(entryRepository.findById(52L)).thenReturn(Optional.of(entry));
        // own_activity is off, but highlight is on — HIGHLIGHTED_YOURS must key off highlight, not own_activity.
        NotificationPreference pref = NotificationPreference.builder().employeeId(7).ownActivity(false).highlight(true).build();
        when(preferenceRepository.findById(7)).thenReturn(Optional.of(pref));
        when(subscriptionService.getActiveSubscriptions(7)).thenReturn(List.of());

        service.notifyActivity(52L, NotificationType.HIGHLIGHTED_YOURS, 3);

        verify(notificationRepository).save(any(Notification.class));
    }

    @Test
    void notifyActivity_neverNotifiesActorAboutTheirOwnEntry() {
        ProactiveWorkEntry entry = ProactiveWorkEntry.builder().id(53L).subjectEmployeeId(7).loggedById(7).isDeleted(false).build();
        when(entryRepository.findById(53L)).thenReturn(Optional.of(entry));

        service.notifyActivity(53L, NotificationType.HIGHLIGHTED_YOURS, 7);

        verifyNoInteractions(preferenceRepository);
        verify(notificationRepository, never()).save(any(Notification.class));
    }
}

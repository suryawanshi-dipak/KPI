package com.kpi.service;

import com.kpi.entity.Employee;
import com.kpi.entity.NotificationPreference;
import com.kpi.entity.ProactiveWorkEntry;
import com.kpi.entity.enums.DeliveryFrequency;
import com.kpi.entity.enums.NewEntryScope;
import com.kpi.entity.enums.NotificationType;
import com.kpi.entity.enums.ProactiveWorkVisibility;
import com.kpi.entity.enums.Role;
import com.kpi.repository.EmployeeRepository;
import com.kpi.repository.NotificationPreferenceRepository;
import com.kpi.repository.NotificationRepository;
import com.kpi.repository.ProactiveWorkEntryRepository;
import com.kpi.service.NotificationService.RecipientDelivery;
import com.kpi.service.impl.NotificationServiceImpl;
import com.kpi.webpush.WebPushSender;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import javax.sql.DataSource;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

class RecipientResolutionTest {

    @Mock private NotificationRepository notificationRepository;
    @Mock private NotificationPreferenceRepository preferenceRepository;
    @Mock private PushSubscriptionService subscriptionService;
    @Mock private ProactiveWorkEntryRepository entryRepository;
    @Mock private EmployeeRepository employeeRepository;
    @Mock private WebPushSender webPushSender;
    @Mock private NotificationFormatter formatter;
    @Mock private DataSource dataSource;

    private NotificationServiceImpl service;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        service = new NotificationServiceImpl(
                notificationRepository,
                preferenceRepository,
                subscriptionService,
                entryRepository,
                employeeRepository,
                webPushSender,
                formatter,
                dataSource
        );
    }

    private Employee createEmployee(int id, String name, String dept, Employee manager) {
        Employee e = new Employee();
        e.setId(id);
        e.setName(name);
        e.setDepartment(dept);
        e.setManager(manager);
        e.setRole(manager == null ? Role.manager : Role.employee);
        return e;
    }

    @Test
    void testOrgWideBroadcastExcludesSubjectAndLogger() {
        // Ananya (id 41) saves an ORGANISATION entry crediting herself.
        // In an org of 400 employees, Ananya is both subject and logger -> excluded.
        Employee ananya = createEmployee(41, "Ananya Kulkarni", "Engineering", null);
        List<Employee> staff = new ArrayList<>();
        staff.add(ananya);
        for (int i = 1; i <= 400; i++) {
            if (i != 41) {
                staff.add(createEmployee(i, "Colleague " + i, "Engineering", ananya));
            }
        }
        when(employeeRepository.findAllWithManager()).thenReturn(staff);
        when(employeeRepository.findById(41)).thenReturn(Optional.of(ananya));

        ProactiveWorkEntry entry = ProactiveWorkEntry.builder()
                .id(100L)
                .loggedById(41)
                .subjectEmployeeId(41)
                .visibility(ProactiveWorkVisibility.ORGANISATION)
                .build();

        LocalDateTime daytime = LocalDateTime.of(2026, 9, 17, 11, 0);
        List<RecipientDelivery> recipients = service.resolveRecipients(entry, daytime);

        // 399 remaining colleagues (everyone except Ananya herself)
        assertThat(recipients).hasSize(399);
        assertThat(recipients).noneMatch(r -> r.recipientId().equals(41));
        assertThat(recipients).allMatch(r -> r.type() == NotificationType.NEW_ENTRY);
        assertThat(recipients).allMatch(RecipientDelivery::eligibleForImmediatePush);
    }

    @Test
    void testPrivateEntryLoggedByManagerOnEmployeeBehalfNotifiesSubjectOnly() {
        // Dipesh (manager, id 12) logs PRIVATE entry crediting Shreyash (id 77)
        Employee dipesh = createEmployee(12, "Dipesh Patil", "Engineering", null);
        Employee shreyash = createEmployee(77, "Shreyash", "Engineering", dipesh);

        when(employeeRepository.findById(12)).thenReturn(Optional.of(dipesh));
        when(employeeRepository.findById(77)).thenReturn(Optional.of(shreyash));

        ProactiveWorkEntry entry = ProactiveWorkEntry.builder()
                .id(101L)
                .loggedById(12)
                .subjectEmployeeId(77)
                .visibility(ProactiveWorkVisibility.PRIVATE)
                .build();

        LocalDateTime daytime = LocalDateTime.of(2026, 9, 17, 14, 0);
        List<RecipientDelivery> recipients = service.resolveRecipients(entry, daytime);

        // Exactly one recipient: Shreyash (77) with LOGGED_FOR_YOU
        assertThat(recipients).hasSize(1);
        RecipientDelivery rd = recipients.get(0);
        assertThat(rd.recipientId()).isEqualTo(77);
        assertThat(rd.type()).isEqualTo(NotificationType.LOGGED_FOR_YOU);
        assertThat(rd.eligibleForImmediatePush()).isTrue();
    }

    @Test
    void testPrivateEntryLoggedByEmployeeForSelfNotifiesManagerOnly() {
        // Shreyash (id 77) logs PRIVATE entry for himself -> notifies his manager Dipesh (12) with NEW_ENTRY
        Employee dipesh = createEmployee(12, "Dipesh Patil", "Engineering", null);
        Employee shreyash = createEmployee(77, "Shreyash", "Engineering", dipesh);

        when(employeeRepository.findAllWithManager()).thenReturn(List.of(dipesh, shreyash));
        when(employeeRepository.findById(77)).thenReturn(Optional.of(shreyash));

        ProactiveWorkEntry entry = ProactiveWorkEntry.builder()
                .id(102L)
                .loggedById(77)
                .subjectEmployeeId(77)
                .visibility(ProactiveWorkVisibility.PRIVATE)
                .build();

        LocalDateTime daytime = LocalDateTime.of(2026, 9, 17, 14, 0);
        List<RecipientDelivery> recipients = service.resolveRecipients(entry, daytime);

        assertThat(recipients).hasSize(1);
        RecipientDelivery rd = recipients.get(0);
        assertThat(rd.recipientId()).isEqualTo(12);
        assertThat(rd.type()).isEqualTo(NotificationType.NEW_ENTRY);
    }

    @Test
    void testNewEntryScopeFiltersMyTeamAndNone() {
        Employee manager = createEmployee(1, "Manager M", "Platform", null);
        Employee teammate = createEmployee(2, "Teammate T", "Platform", manager);
        Employee otherDept = createEmployee(3, "Other O", "Sales", null);
        Employee optOut = createEmployee(4, "OptOut X", "Platform", manager);
        Employee author = createEmployee(5, "Author A", "Platform", manager);

        when(employeeRepository.findAllWithManager()).thenReturn(List.of(manager, teammate, otherDept, optOut, author));
        when(employeeRepository.findById(5)).thenReturn(Optional.of(author));

        // teammate has MY_TEAM
        NotificationPreference prefTeammate = NotificationPreference.builder()
                .employeeId(2).newEntryScope(NewEntryScope.MY_TEAM).build();
        // otherDept has MY_TEAM (should be excluded because Sales != Platform)
        NotificationPreference prefOther = NotificationPreference.builder()
                .employeeId(3).newEntryScope(NewEntryScope.MY_TEAM).build();
        // optOut has NONE
        NotificationPreference prefOptOut = NotificationPreference.builder()
                .employeeId(4).newEntryScope(NewEntryScope.NONE).build();

        when(preferenceRepository.findAllById(any())).thenReturn(List.of(prefTeammate, prefOther, prefOptOut));

        ProactiveWorkEntry entry = ProactiveWorkEntry.builder()
                .id(103L)
                .loggedById(5)
                .subjectEmployeeId(5)
                .visibility(ProactiveWorkVisibility.ORGANISATION)
                .build();

        LocalDateTime daytime = LocalDateTime.of(2026, 9, 17, 10, 0);
        List<RecipientDelivery> recipients = service.resolveRecipients(entry, daytime);

        List<Integer> recipientIds = recipients.stream().map(RecipientDelivery::recipientId).toList();
        // manager (Platform dept) and teammate (Platform dept) are included
        assertThat(recipientIds).contains(1, 2);
        // otherDept (Sales) is excluded because of MY_TEAM
        assertThat(recipientIds).doesNotContain(3);
        // optOut is excluded because of NONE
        assertThat(recipientIds).doesNotContain(4);
        // author is excluded (logger + subject)
        assertThat(recipientIds).doesNotContain(5);
    }

    @Test
    void testQuietHoursSuppressesImmediatePush() {
        Employee author = createEmployee(1, "Author", "Engineering", null);
        Employee quietEmployee = createEmployee(2, "Quiet User", "Engineering", null);

        when(employeeRepository.findAllWithManager()).thenReturn(List.of(author, quietEmployee));
        when(employeeRepository.findById(1)).thenReturn(Optional.of(author));

        // Quiet hours 19:00 — 09:00
        NotificationPreference pref = NotificationPreference.builder()
                .employeeId(2)
                .quietFrom(LocalTime.of(19, 0))
                .quietTo(LocalTime.of(9, 0))
                .delivery(DeliveryFrequency.INSTANT)
                .build();
        when(preferenceRepository.findAllById(any())).thenReturn(List.of(pref));

        ProactiveWorkEntry entry = ProactiveWorkEntry.builder()
                .id(104L)
                .loggedById(1)
                .subjectEmployeeId(1)
                .visibility(ProactiveWorkVisibility.ORGANISATION)
                .build();

        // Entry logged at 21:30 (inside quiet window)
        LocalDateTime evening = LocalDateTime.of(2026, 9, 17, 21, 30);
        List<RecipientDelivery> recipients = service.resolveRecipients(entry, evening);

        assertThat(recipients).hasSize(1);
        RecipientDelivery rd = recipients.get(0);
        assertThat(rd.recipientId()).isEqualTo(2);
        // Notification row is created, but immediate push is deferred!
        assertThat(rd.eligibleForImmediatePush()).isFalse();
    }

    @Test
    void testDigestDeliverySuppressesImmediatePush() {
        Employee author = createEmployee(1, "Author", "Engineering", null);
        Employee digestEmployee = createEmployee(2, "Digest User", "Engineering", null);

        when(employeeRepository.findAllWithManager()).thenReturn(List.of(author, digestEmployee));
        when(employeeRepository.findById(1)).thenReturn(Optional.of(author));

        NotificationPreference pref = NotificationPreference.builder()
                .employeeId(2)
                .delivery(DeliveryFrequency.DAILY_DIGEST)
                .build();
        when(preferenceRepository.findAllById(any())).thenReturn(List.of(pref));

        ProactiveWorkEntry entry = ProactiveWorkEntry.builder()
                .id(105L)
                .loggedById(1)
                .subjectEmployeeId(1)
                .visibility(ProactiveWorkVisibility.ORGANISATION)
                .build();

        LocalDateTime morning = LocalDateTime.of(2026, 9, 17, 10, 0);
        List<RecipientDelivery> recipients = service.resolveRecipients(entry, morning);

        assertThat(recipients).hasSize(1);
        RecipientDelivery rd = recipients.get(0);
        assertThat(rd.recipientId()).isEqualTo(2);
        assertThat(rd.eligibleForImmediatePush()).isFalse();
    }
}

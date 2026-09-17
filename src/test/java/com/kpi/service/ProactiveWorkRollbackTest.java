package com.kpi.service;

import com.kpi.dto.request.ProactiveWorkEntryRequest;
import com.kpi.entity.Employee;
import com.kpi.entity.enums.ProactiveWorkCategory;
import com.kpi.entity.enums.Role;
import com.kpi.event.ProactiveWorkCreatedEvent;
import com.kpi.event.ProactiveWorkEventListener;
import com.kpi.exception.ProactiveWorkValidationException;
import com.kpi.repository.*;
import com.kpi.service.impl.ProactiveWorkServiceImpl;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.lang.reflect.Method;
import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class ProactiveWorkRollbackTest {

    @Mock private ProactiveWorkEntryRepository entryRepository;
    @Mock private ProactiveWorkEndorsementRepository endorsementRepository;
    @Mock private ProactiveWorkCommentRepository commentRepository;
    @Mock private EmployeeRepository employeeRepository;
    @Mock private KpiMeasurementRepository measurementRepository;
    @Mock private ProactiveWorkAuditService auditService;
    @Mock private ApplicationEventPublisher eventPublisher;
    @Mock private NotificationService notificationService;

    private ProactiveWorkServiceImpl proactiveWorkService;
    private ProactiveWorkEventListener listener;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
        proactiveWorkService = new ProactiveWorkServiceImpl(
                entryRepository,
                endorsementRepository,
                commentRepository,
                employeeRepository,
                measurementRepository,
                auditService,
                validator,
                eventPublisher
        );
        listener = new ProactiveWorkEventListener(notificationService);

        Employee actor = new Employee();
        actor.setId(41);
        actor.setEmail("ananya@vitec.co.in");
        actor.setRole(Role.employee);

        // 3-arg constructor with an authorities list marks the token authenticated; the 2-arg
        // constructor used previously always yields isAuthenticated() == false, which made
        // currentEmployeeOrThrow() reject every call with AccessDeniedException before the
        // validation logic under test ever ran.
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("ananya@vitec.co.in", null,
                        java.util.List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_employee"))));
        when(employeeRepository.findByEmail("ananya@vitec.co.in")).thenReturn(Optional.of(actor));
        when(employeeRepository.findById(41)).thenReturn(Optional.of(actor));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void testFailedTransactionPublishesNoEventsAndNotifiesNobody() {
        // Request with invalid date constraint (effortEndDate < effortStartDate) -> triggers rollback/exception
        ProactiveWorkEntryRequest invalidRequest = ProactiveWorkEntryRequest.builder()
                .subjectEmployeeId(41)
                .category(ProactiveWorkCategory.TEAM_SUPPORT)
                .title("Covered on-call")
                .description("Handled late shifts")
                .effortStartDate(LocalDate.of(2026, 9, 10))
                .effortEndDate(LocalDate.of(2026, 9, 5)) // invalid: end before start!
                .build();

        assertThatThrownBy(() -> proactiveWorkService.create(invalidRequest))
                .isInstanceOf(ProactiveWorkValidationException.class);

        // Verify that on failure, no event was published
        verify(eventPublisher, never()).publishEvent(any(ProactiveWorkCreatedEvent.class));
        // Verify notification service was never invoked
        verify(notificationService, never()).fanOutForEntry(anyLong());
    }

    @Test
    void testEventListenerIsConfiguredWithAfterCommitPhase() throws NoSuchMethodException {
        // Verify via reflection that onProactiveWorkCreated has @TransactionalEventListener(phase = AFTER_COMMIT)
        Method method = ProactiveWorkEventListener.class.getMethod("onProactiveWorkCreated", ProactiveWorkCreatedEvent.class);
        TransactionalEventListener annotation = method.getAnnotation(TransactionalEventListener.class);

        assertThat(annotation).isNotNull();
        assertThat(annotation.phase()).isEqualTo(TransactionPhase.AFTER_COMMIT);
    }
}

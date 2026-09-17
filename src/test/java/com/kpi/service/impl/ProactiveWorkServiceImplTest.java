package com.kpi.service.impl;

import com.kpi.dto.request.ProactiveWorkCommentRequest;
import com.kpi.dto.request.ProactiveWorkEntryRequest;
import com.kpi.entity.Employee;
import com.kpi.entity.KpiMeasurement;
import com.kpi.entity.KpiMetric;
import com.kpi.entity.ProactiveWorkComment;
import com.kpi.entity.ProactiveWorkEndorsement;
import com.kpi.entity.ProactiveWorkEntry;
import com.kpi.entity.enums.ProactiveWorkAuditActionType;
import com.kpi.entity.enums.ProactiveWorkCategory;
import com.kpi.entity.enums.ProactiveWorkVisibility;
import com.kpi.entity.enums.Role;
import com.kpi.exception.ProactiveWorkValidationException;
import com.kpi.repository.EmployeeRepository;
import com.kpi.repository.KpiMeasurementRepository;
import com.kpi.repository.ProactiveWorkCommentRepository;
import com.kpi.repository.ProactiveWorkEndorsementRepository;
import com.kpi.repository.ProactiveWorkEntryRepository;
import com.kpi.service.ProactiveWorkAuditService;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class ProactiveWorkServiceImplTest {

    @Mock private ProactiveWorkEntryRepository entryRepository;
    @Mock private ProactiveWorkEndorsementRepository endorsementRepository;
    @Mock private ProactiveWorkCommentRepository commentRepository;
    @Mock private EmployeeRepository employeeRepository;
    @Mock private KpiMeasurementRepository measurementRepository;
    @Mock private ProactiveWorkAuditService auditService;
    @Mock private org.springframework.context.ApplicationEventPublisher eventPublisher;

    private Validator validator;
    private ProactiveWorkServiceImpl service;

    private Employee admin, manager, otherManager, reportOfManager, otherEmployee, employeeSelf;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        validator = Validation.buildDefaultValidatorFactory().getValidator();
        service = new ProactiveWorkServiceImpl(entryRepository, endorsementRepository, commentRepository,
                employeeRepository, measurementRepository, auditService, validator, eventPublisher);

        admin = employee(1, Role.admin, null);
        manager = employee(2, Role.manager, null);
        otherManager = employee(6, Role.manager, null);
        reportOfManager = employee(3, Role.employee, manager);
        otherEmployee = employee(4, Role.employee, null);
        employeeSelf = employee(5, Role.employee, null);

        when(entryRepository.save(any(ProactiveWorkEntry.class))).thenAnswer(inv -> {
            ProactiveWorkEntry e = inv.getArgument(0);
            if (e.getId() == null) e.setId(100L);
            return e;
        });
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private Employee employee(Integer id, Role role, Employee manager) {
        Employee e = new Employee();
        e.setId(id);
        e.setRole(role);
        e.setManager(manager);
        e.setName("Employee " + id);
        e.setEmail("employee" + id + "@vitec.test");
        return e;
    }

    private void loginAs(Employee actor) {
        when(employeeRepository.findByEmail(actor.getEmail())).thenReturn(Optional.of(actor));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(actor.getEmail(), null, List.of()));
    }

    private ProactiveWorkEntryRequest baseRequest(Integer subjectId) {
        return ProactiveWorkEntryRequest.builder()
                .subjectEmployeeId(subjectId)
                .category(ProactiveWorkCategory.TEAM_SUPPORT)
                .title("Covered the on-call rotation")
                .description("Filled in for a sick teammate.")
                .effortStartDate(LocalDate.of(2026, 9, 8))
                .build();
    }

    private ProactiveWorkEntry entry(Long id, Integer subjectId, Integer loggedById, ProactiveWorkVisibility visibility) {
        return ProactiveWorkEntry.builder()
                .id(id).subjectEmployeeId(subjectId).loggedById(loggedById)
                .category(ProactiveWorkCategory.EXTRA_HOURS).title("t").description("d")
                .effortStartDate(LocalDate.of(2026, 9, 1)).effortEndDate(LocalDate.of(2026, 9, 1))
                .visibility(visibility)
                .isSeen(false).isHighlighted(false).isDeleted(false)
                .endorsementCount(0).commentCount(0)
                .build();
    }

    /* ---------- create ---------- */

    @Test
    void employeeCreatingForSelf_succeeds() {
        loginAs(employeeSelf);
        when(employeeRepository.findById(employeeSelf.getId())).thenReturn(Optional.of(employeeSelf));
        ProactiveWorkEntryRequest req = baseRequest(employeeSelf.getId());

        service.create(req);

        verify(entryRepository).save(argThat(e ->
                e.getSubjectEmployeeId().equals(employeeSelf.getId()) &&
                e.getLoggedById().equals(employeeSelf.getId()) &&
                e.getVisibility() == ProactiveWorkVisibility.ORGANISATION));
        verify(auditService).record(eq(100L), eq(ProactiveWorkAuditActionType.CREATE),
                eq(employeeSelf.getId()), isNull(), any());
    }

    @Test
    void employeeCreatingForAnotherEmployee_succeeds() {
        loginAs(employeeSelf);
        when(employeeRepository.findById(otherEmployee.getId())).thenReturn(Optional.of(otherEmployee));
        ProactiveWorkEntryRequest req = baseRequest(otherEmployee.getId());

        service.create(req);

        verify(entryRepository).save(argThat(e ->
                e.getSubjectEmployeeId().equals(otherEmployee.getId()) &&
                e.getLoggedById().equals(employeeSelf.getId())));
    }

    @Test
    void managerCreatingForDirectReport_succeeds() {
        loginAs(manager);
        when(employeeRepository.findById(reportOfManager.getId())).thenReturn(Optional.of(reportOfManager));
        ProactiveWorkEntryRequest req = baseRequest(reportOfManager.getId());

        service.create(req);

        verify(entryRepository).save(argThat(e ->
                e.getSubjectEmployeeId().equals(reportOfManager.getId()) &&
                e.getLoggedById().equals(manager.getId())));
    }

    @Test
    void managerCreatingForSomeoneNotTheirReport_isForbidden() {
        loginAs(manager);
        when(employeeRepository.findById(otherEmployee.getId())).thenReturn(Optional.of(otherEmployee));
        ProactiveWorkEntryRequest req = baseRequest(otherEmployee.getId());

        assertThatThrownBy(() -> service.create(req)).isInstanceOf(AccessDeniedException.class);
        verify(entryRepository, never()).save(any());
        verifyNoInteractions(auditService);
    }

    @Test
    void adminCreatingForAnyone_succeeds() {
        loginAs(admin);
        when(employeeRepository.findById(otherEmployee.getId())).thenReturn(Optional.of(otherEmployee));
        ProactiveWorkEntryRequest req = baseRequest(otherEmployee.getId());

        service.create(req);

        verify(entryRepository).save(argThat(e ->
                e.getSubjectEmployeeId().equals(otherEmployee.getId()) &&
                e.getLoggedById().equals(admin.getId())));
    }

    @Test
    void requestingPrivateVisibility_isRespected() {
        loginAs(employeeSelf);
        when(employeeRepository.findById(employeeSelf.getId())).thenReturn(Optional.of(employeeSelf));
        ProactiveWorkEntryRequest req = baseRequest(employeeSelf.getId());
        req.setVisibility(ProactiveWorkVisibility.PRIVATE);

        service.create(req);

        verify(entryRepository).save(argThat(e -> e.getVisibility() == ProactiveWorkVisibility.PRIVATE));
    }

    @Test
    void otherCategoryWithBlankText_failsValidationBeforeAnyWrite() {
        loginAs(employeeSelf);
        ProactiveWorkEntryRequest req = baseRequest(employeeSelf.getId());
        req.setCategory(ProactiveWorkCategory.OTHER);
        req.setOtherCategoryText("  ");

        assertThatThrownBy(() -> service.create(req))
                .isInstanceOf(ProactiveWorkValidationException.class)
                .satisfies(ex -> {
                    ProactiveWorkValidationException pwe = (ProactiveWorkValidationException) ex;
                    assertThat(pwe.getField()).isEqualTo("otherCategoryText");
                    assertThat(pwe.getMessage()).isEqualTo("Tell us what kind of work this was.");
                });
        verify(entryRepository, never()).save(any());
    }

    @Test
    void kpiLinkedEntry_measurementSubjectMismatch_isRejected() {
        loginAs(employeeSelf);
        when(employeeRepository.findById(employeeSelf.getId())).thenReturn(Optional.of(employeeSelf));
        ProactiveWorkEntryRequest req = baseRequest(employeeSelf.getId());
        req.setKpiMeasurementId(500L);

        KpiMeasurement measurement = KpiMeasurement.builder()
                .id(500L)
                .kpiMetric(KpiMetric.builder().id(1).name("Production Defect Rate").build())
                .subjectEmployeeId(otherEmployee.getId())
                .build();
        when(measurementRepository.findById(500L)).thenReturn(Optional.of(measurement));

        assertThatThrownBy(() -> service.create(req))
                .isInstanceOf(ProactiveWorkValidationException.class)
                .satisfies(ex -> assertThat(((ProactiveWorkValidationException) ex).getField()).isEqualTo("kpiMeasurementId"));
        verify(entryRepository, never()).save(any());
    }

    /* ---------- visibility / view access ---------- */

    @Test
    void unrelatedEmployee_cannotViewPrivateEntry() {
        loginAs(employeeSelf);
        ProactiveWorkEntry entry = entry(501L, otherEmployee.getId(), otherEmployee.getId(), ProactiveWorkVisibility.PRIVATE);
        when(entryRepository.findByIdAndIsDeletedFalse(501L)).thenReturn(Optional.of(entry));

        assertThatThrownBy(() -> service.getByIdAndMarkSeen(501L)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void unrelatedEmployee_canViewOrganisationWideEntry() {
        // v2's core change: ORGANISATION is the default, and it means everyone at Vitec, not
        // just the subject's own team.
        loginAs(employeeSelf);
        ProactiveWorkEntry entry = entry(502L, otherEmployee.getId(), otherEmployee.getId(), ProactiveWorkVisibility.ORGANISATION);
        when(entryRepository.findByIdAndIsDeletedFalse(502L)).thenReturn(Optional.of(entry));
        when(employeeRepository.findById(otherEmployee.getId())).thenReturn(Optional.of(otherEmployee));

        var response = service.getByIdAndMarkSeen(502L);

        assertThat(response.getId()).isEqualTo(502L);
    }

    @Test
    void employeeWhoLoggedForSomeoneElse_canViewIt_butDoesNotMarkItSeen() {
        loginAs(employeeSelf);
        ProactiveWorkEntry entry = entry(500L, otherEmployee.getId(), employeeSelf.getId(), ProactiveWorkVisibility.PRIVATE);
        when(entryRepository.findByIdAndIsDeletedFalse(500L)).thenReturn(Optional.of(entry));

        service.getByIdAndMarkSeen(500L);

        assertThat(entry.getIsSeen()).isFalse();
        assertThat(entry.getSeenAt()).isNull();
        verifyNoInteractions(auditService);
    }

    @Test
    void managerViewingReportsEntry_marksSeenOnce_secondViewDoesNotChangeSeenAt() {
        loginAs(manager);
        ProactiveWorkEntry entry = entry(200L, reportOfManager.getId(), reportOfManager.getId(), ProactiveWorkVisibility.ORGANISATION);
        when(entryRepository.findByIdAndIsDeletedFalse(200L)).thenReturn(Optional.of(entry));
        when(employeeRepository.findById(reportOfManager.getId())).thenReturn(Optional.of(reportOfManager));

        service.getByIdAndMarkSeen(200L);
        assertThat(entry.getIsSeen()).isTrue();
        LocalDateTime firstSeenAt = entry.getSeenAt();
        assertThat(firstSeenAt).isNotNull();
        assertThat(entry.getSeenById()).isEqualTo(manager.getId());

        service.getByIdAndMarkSeen(200L);
        assertThat(entry.getSeenAt()).isEqualTo(firstSeenAt);

        verify(auditService, times(1)).record(eq(200L), eq(ProactiveWorkAuditActionType.SEEN), eq(manager.getId()), any(), any());
    }

    @Test
    void aDifferentManager_canViewOrgWideEntry_butDoesNotMarkItSeen() {
        // The subject's manager is `manager`, not `otherManager`. Org-wide visibility lets
        // otherManager open it, but only the subject's own manager may stamp is_seen.
        loginAs(otherManager);
        ProactiveWorkEntry entry = entry(201L, reportOfManager.getId(), reportOfManager.getId(), ProactiveWorkVisibility.ORGANISATION);
        when(entryRepository.findByIdAndIsDeletedFalse(201L)).thenReturn(Optional.of(entry));
        when(employeeRepository.findById(reportOfManager.getId())).thenReturn(Optional.of(reportOfManager));

        service.getByIdAndMarkSeen(201L);

        assertThat(entry.getIsSeen()).isFalse();
        verifyNoInteractions(auditService);
    }

    @Test
    void subjectViewingTheirOwnEntry_neverSetsSeen() {
        loginAs(reportOfManager);
        ProactiveWorkEntry entry = entry(300L, reportOfManager.getId(), reportOfManager.getId(), ProactiveWorkVisibility.ORGANISATION);
        when(entryRepository.findByIdAndIsDeletedFalse(300L)).thenReturn(Optional.of(entry));

        service.getByIdAndMarkSeen(300L);

        assertThat(entry.getIsSeen()).isFalse();
        assertThat(entry.getSeenAt()).isNull();
        verifyNoInteractions(auditService);
    }

    @Test
    void employeeGettingSubjectFilterForSomeoneElse_returnsEmpty_notData() {
        loginAs(employeeSelf);

        List<?> result = service.list(otherEmployee.getId(), null, null);

        assertThat(result).isEmpty();
        verifyNoInteractions(entryRepository);
    }

    /* ---------- highlight ---------- */

    @Test
    void employeeCannotHighlightEvenTheirOwnEntry() {
        loginAs(employeeSelf);
        ProactiveWorkEntry entry = entry(400L, employeeSelf.getId(), employeeSelf.getId(), ProactiveWorkVisibility.ORGANISATION);

        assertThatThrownBy(() -> service.setHighlighted(400L, true)).isInstanceOf(AccessDeniedException.class);
        verify(entryRepository, never()).findByIdAndIsDeletedFalse(any());
        verify(entryRepository, never()).save(any());
        verifyNoInteractions(auditService);
    }

    @Test
    void managerCanHighlightReportsEntry() {
        loginAs(manager);
        ProactiveWorkEntry entry = entry(401L, reportOfManager.getId(), reportOfManager.getId(), ProactiveWorkVisibility.ORGANISATION);
        when(entryRepository.findByIdAndIsDeletedFalse(401L)).thenReturn(Optional.of(entry));
        when(employeeRepository.findById(reportOfManager.getId())).thenReturn(Optional.of(reportOfManager));

        service.setHighlighted(401L, true);

        assertThat(entry.getIsHighlighted()).isTrue();
        assertThat(entry.getHighlightedAt()).isNotNull();
        verify(auditService).record(eq(401L), eq(ProactiveWorkAuditActionType.HIGHLIGHT_ON), eq(manager.getId()), any(), any());
    }

    @Test
    void aDifferentManager_cannotHighlight_despiteBeingAbleToViewIt() {
        loginAs(otherManager);
        ProactiveWorkEntry entry = entry(402L, reportOfManager.getId(), reportOfManager.getId(), ProactiveWorkVisibility.ORGANISATION);
        when(entryRepository.findByIdAndIsDeletedFalse(402L)).thenReturn(Optional.of(entry));
        when(employeeRepository.findById(reportOfManager.getId())).thenReturn(Optional.of(reportOfManager));

        assertThatThrownBy(() -> service.setHighlighted(402L, true)).isInstanceOf(AccessDeniedException.class);
        verify(entryRepository, never()).save(any());
    }

    /* ---------- endorsement ---------- */

    @Test
    void cannotEndorseOwnEntry() {
        loginAs(employeeSelf);
        ProactiveWorkEntry entry = entry(600L, employeeSelf.getId(), employeeSelf.getId(), ProactiveWorkVisibility.ORGANISATION);
        when(entryRepository.findByIdAndIsDeletedFalse(600L)).thenReturn(Optional.of(entry));

        assertThatThrownBy(() -> service.setEndorsed(600L, true)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void cannotEndorsePrivateEntry() {
        loginAs(employeeSelf);
        ProactiveWorkEntry entry = entry(601L, otherEmployee.getId(), otherEmployee.getId(), ProactiveWorkVisibility.PRIVATE);
        when(entryRepository.findByIdAndIsDeletedFalse(601L)).thenReturn(Optional.of(entry));
        when(employeeRepository.findById(otherEmployee.getId())).thenReturn(Optional.of(otherEmployee));

        // employeeSelf isn't subject/logger/manager/admin here, so isVisible already denies —
        // this proves the PRIVATE block, not just the visibility gate, by using a viewer who
        // *would* otherwise be blocked at the visibility check first. See the admin case below
        // for proof PRIVATE blocks even a viewer who CAN see the entry.
        assertThatThrownBy(() -> service.setEndorsed(601L, true)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void adminCannotEndorsePrivateEntryEitherDespiteFullVisibility() {
        loginAs(admin);
        ProactiveWorkEntry entry = entry(602L, otherEmployee.getId(), otherEmployee.getId(), ProactiveWorkVisibility.PRIVATE);
        when(entryRepository.findByIdAndIsDeletedFalse(602L)).thenReturn(Optional.of(entry));

        assertThatThrownBy(() -> service.setEndorsed(602L, true)).isInstanceOf(AccessDeniedException.class);
        verify(endorsementRepository, never()).save(any());
    }

    @Test
    void endorsing_createsRowAndUpdatesCount() {
        loginAs(otherEmployee);
        ProactiveWorkEntry entry = entry(603L, employeeSelf.getId(), employeeSelf.getId(), ProactiveWorkVisibility.ORGANISATION);
        when(entryRepository.findByIdAndIsDeletedFalse(603L)).thenReturn(Optional.of(entry));
        when(endorsementRepository.findByEntryIdAndEmployeeId(603L, otherEmployee.getId())).thenReturn(Optional.empty());
        when(endorsementRepository.countByEntryIdAndWithdrawnAtIsNull(603L)).thenReturn(1L);

        service.setEndorsed(603L, true);

        verify(endorsementRepository).save(argThat(en ->
                en.getEntryId().equals(603L) && en.getEmployeeId().equals(otherEmployee.getId())
                        && en.getSubjectEmployeeId().equals(employeeSelf.getId())));
        assertThat(entry.getEndorsementCount()).isEqualTo(1);
        verifyNoInteractions(auditService);
    }

    @Test
    void withdrawingEndorsement_setsWithdrawnAtAndUpdatesCount() {
        loginAs(otherEmployee);
        ProactiveWorkEntry entry = entry(604L, employeeSelf.getId(), employeeSelf.getId(), ProactiveWorkVisibility.ORGANISATION);
        entry.setEndorsementCount(1);
        ProactiveWorkEndorsement existing = ProactiveWorkEndorsement.builder()
                .id(9L).entryId(604L).employeeId(otherEmployee.getId()).subjectEmployeeId(employeeSelf.getId())
                .createdAt(LocalDateTime.now()).build();
        when(entryRepository.findByIdAndIsDeletedFalse(604L)).thenReturn(Optional.of(entry));
        when(endorsementRepository.findByEntryIdAndEmployeeId(604L, otherEmployee.getId())).thenReturn(Optional.of(existing));
        when(endorsementRepository.countByEntryIdAndWithdrawnAtIsNull(604L)).thenReturn(0L);

        service.setEndorsed(604L, false);

        assertThat(existing.getWithdrawnAt()).isNotNull();
        assertThat(entry.getEndorsementCount()).isEqualTo(0);
    }

    /* ---------- comments ---------- */

    @Test
    void addingComment_savesAndUpdatesCount() {
        loginAs(otherEmployee);
        ProactiveWorkEntry entry = entry(700L, employeeSelf.getId(), employeeSelf.getId(), ProactiveWorkVisibility.ORGANISATION);
        when(entryRepository.findByIdAndIsDeletedFalse(700L)).thenReturn(Optional.of(entry));
        when(commentRepository.save(any(ProactiveWorkComment.class))).thenAnswer(inv -> {
            ProactiveWorkComment c = inv.getArgument(0);
            c.setId(50L);
            c.setCreatedAt(LocalDateTime.now());
            return c;
        });
        when(commentRepository.countByEntryIdAndIsDeletedFalse(700L)).thenReturn(1L);

        var response = service.addComment(700L, ProactiveWorkCommentRequest.builder().body("Nice work").build());

        assertThat(response.getBody()).isEqualTo("Nice work");
        assertThat(entry.getCommentCount()).isEqualTo(1);
    }

    @Test
    void cannotCommentOnPrivateEntry() {
        loginAs(admin);
        ProactiveWorkEntry entry = entry(701L, otherEmployee.getId(), otherEmployee.getId(), ProactiveWorkVisibility.PRIVATE);
        when(entryRepository.findByIdAndIsDeletedFalse(701L)).thenReturn(Optional.of(entry));

        assertThatThrownBy(() -> service.addComment(701L, ProactiveWorkCommentRequest.builder().body("hi").build()))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void onlyAuthorCanEditTheirComment() {
        loginAs(otherEmployee);
        ProactiveWorkComment comment = ProactiveWorkComment.builder()
                .id(51L).entryId(700L).authorId(employeeSelf.getId()).body("original")
                .createdAt(LocalDateTime.now()).isDeleted(false).build();
        when(commentRepository.findByIdAndIsDeletedFalse(51L)).thenReturn(Optional.of(comment));

        assertThatThrownBy(() -> service.editComment(51L, ProactiveWorkCommentRequest.builder().body("edited").build()))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void authorOrAdminCanDeleteComment_softDeleteOnly() {
        loginAs(admin);
        ProactiveWorkComment comment = ProactiveWorkComment.builder()
                .id(52L).entryId(700L).authorId(otherEmployee.getId()).body("original")
                .createdAt(LocalDateTime.now()).isDeleted(false).build();
        ProactiveWorkEntry entry = entry(700L, employeeSelf.getId(), employeeSelf.getId(), ProactiveWorkVisibility.ORGANISATION);
        when(commentRepository.findByIdAndIsDeletedFalse(52L)).thenReturn(Optional.of(comment));
        when(entryRepository.findByIdAndIsDeletedFalse(700L)).thenReturn(Optional.of(entry));
        when(commentRepository.countByEntryIdAndIsDeletedFalse(700L)).thenReturn(0L);

        service.deleteComment(52L);

        assertThat(comment.getIsDeleted()).isTrue();
        verify(commentRepository).save(comment);
    }

    /* ---------- edit / lock ---------- */

    @Test
    void authorCanEditDetailsAndValueStatement() {
        loginAs(employeeSelf);
        ProactiveWorkEntry entry = entry(800L, employeeSelf.getId(), employeeSelf.getId(), ProactiveWorkVisibility.ORGANISATION);
        when(entryRepository.findByIdAndIsDeletedFalse(800L)).thenReturn(Optional.of(entry));

        ProactiveWorkEntryRequest req = baseRequest(employeeSelf.getId());
        req.setTitle(entry.getTitle());
        req.setDescription("Updated details.");
        req.setValueStatement("Saves 3 hours a week.");

        service.update(800L, req);

        assertThat(entry.getDescription()).isEqualTo("Updated details.");
        assertThat(entry.getValueStatement()).isEqualTo("Saves 3 hours a week.");
        assertThat(entry.getEditedAt()).isNotNull();
        verify(auditService).record(eq(800L), eq(ProactiveWorkAuditActionType.EDIT), eq(employeeSelf.getId()), any(), any());
    }

    @Test
    void nonAuthorNonAdminCannotEdit() {
        loginAs(otherEmployee);
        ProactiveWorkEntry entry = entry(801L, employeeSelf.getId(), employeeSelf.getId(), ProactiveWorkVisibility.ORGANISATION);
        when(entryRepository.findByIdAndIsDeletedFalse(801L)).thenReturn(Optional.of(entry));

        assertThatThrownBy(() -> service.update(801L, baseRequest(employeeSelf.getId())))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void titleAndCategoryLockOnceEndorsed_forNonAdmin() {
        loginAs(employeeSelf);
        ProactiveWorkEntry entry = entry(802L, employeeSelf.getId(), employeeSelf.getId(), ProactiveWorkVisibility.ORGANISATION);
        entry.setEndorsementCount(1);
        when(entryRepository.findByIdAndIsDeletedFalse(802L)).thenReturn(Optional.of(entry));

        ProactiveWorkEntryRequest req = baseRequest(employeeSelf.getId());
        req.setTitle("A completely different title");

        assertThatThrownBy(() -> service.update(802L, req))
                .isInstanceOf(ProactiveWorkValidationException.class)
                .satisfies(ex -> assertThat(((ProactiveWorkValidationException) ex).getField()).isEqualTo("title"));
    }

    @Test
    void adminCanOverrideTitleLockAfterEndorsement() {
        loginAs(admin);
        ProactiveWorkEntry entry = entry(803L, employeeSelf.getId(), employeeSelf.getId(), ProactiveWorkVisibility.ORGANISATION);
        entry.setEndorsementCount(3);
        when(entryRepository.findByIdAndIsDeletedFalse(803L)).thenReturn(Optional.of(entry));

        ProactiveWorkEntryRequest req = baseRequest(employeeSelf.getId());
        req.setTitle("Admin-corrected title");

        service.update(803L, req);

        assertThat(entry.getTitle()).isEqualTo("Admin-corrected title");
    }

    @Test
    void employeesOwnUnfilteredList_includesEntriesTheyLoggedForSomeoneElse() {
        loginAs(employeeSelf);

        service.list(null, null, null);

        verify(entryRepository).findBySubjectOrLoggedByAndIsDeletedFalse(employeeSelf.getId());
    }
}

package com.kpi.service.impl;

import com.kpi.dto.request.ProactiveWorkCommentRequest;
import com.kpi.dto.request.ProactiveWorkEntryRequest;
import com.kpi.dto.response.PagedResponse;
import com.kpi.dto.response.ProactiveWorkCommentResponse;
import com.kpi.dto.response.ProactiveWorkEndorserResponse;
import com.kpi.dto.response.ProactiveWorkEntryResponse;
import com.kpi.dto.response.ProactiveWorkEntrySummaryResponse;
import com.kpi.entity.Employee;
import com.kpi.entity.KpiMeasurement;
import com.kpi.entity.ProactiveWorkComment;
import com.kpi.entity.ProactiveWorkEndorsement;
import com.kpi.entity.ProactiveWorkEntry;
import com.kpi.entity.enums.ProactiveWorkAuditActionType;
import com.kpi.entity.enums.ProactiveWorkCategory;
import com.kpi.entity.enums.ProactiveWorkEntryType;
import com.kpi.entity.enums.ProactiveWorkVisibility;
import com.kpi.entity.enums.Role;
import com.kpi.exception.ProactiveWorkValidationException;
import com.kpi.exception.ResourceNotFoundException;
import com.kpi.repository.EmployeeRepository;
import com.kpi.repository.KpiMeasurementRepository;
import com.kpi.repository.ProactiveWorkCommentRepository;
import com.kpi.repository.ProactiveWorkEndorsementRepository;
import com.kpi.repository.ProactiveWorkEntryRepository;
import com.kpi.service.ProactiveWorkAuditService;
import com.kpi.service.ProactiveWorkService;
import com.kpi.util.EmployeeUtils;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProactiveWorkServiceImpl implements ProactiveWorkService {

    private final ProactiveWorkEntryRepository entryRepository;
    private final ProactiveWorkEndorsementRepository endorsementRepository;
    private final ProactiveWorkCommentRepository commentRepository;
    private final EmployeeRepository employeeRepository;
    private final KpiMeasurementRepository measurementRepository;
    private final ProactiveWorkAuditService auditService;
    private final Validator validator;

    @Override
    @Transactional
    public ProactiveWorkEntryResponse create(ProactiveWorkEntryRequest request) {
        Employee actor = currentEmployeeOrThrow();
        validateRequest(request);

        Integer subjectId = request.getSubjectEmployeeId();
        if (actor.getRole() == Role.employee) {
            // "Credit to" defaults to self but is not locked — any employee may credit any
            // other employee (a manager, a peer on another team, etc.).
            employeeRepository.findById(subjectId)
                    .orElseThrow(() -> new ResourceNotFoundException("Employee", subjectId));
        } else if (actor.getRole() == Role.manager) {
            boolean allowed = subjectId.equals(actor.getId()) || isDirectReport(actor.getId(), subjectId);
            if (!allowed) {
                throw new AccessDeniedException(
                        "Managers can only log proactive work for themselves or their direct reports");
            }
        } else if (actor.getRole() == Role.admin) {
            Integer adminSubjectId = subjectId;
            employeeRepository.findById(adminSubjectId)
                    .orElseThrow(() -> new ResourceNotFoundException("Employee", adminSubjectId));
        } else {
            throw new AccessDeniedException("Role not authorized to log proactive work");
        }

        KpiMeasurement measurement = null;
        if (request.getKpiMeasurementId() != null) {
            measurement = measurementRepository.findById(request.getKpiMeasurementId())
                    .orElseThrow(() -> new ResourceNotFoundException("KPI Measurement", request.getKpiMeasurementId()));
            if (!measurement.getSubjectEmployeeId().equals(subjectId)) {
                throw new ProactiveWorkValidationException(
                        "kpiMeasurementId", "This measurement doesn't belong to the credited employee.");
            }
        }

        LocalDate start = request.getEffortStartDate();
        LocalDate end = request.getEffortEndDate() != null ? request.getEffortEndDate() : start;
        if (end.isBefore(start)) {
            throw new ProactiveWorkValidationException("effortEndDate", "Last day can't be before the start date.");
        }

        ProactiveWorkEntry entry = ProactiveWorkEntry.builder()
                .kpiMeasurementId(measurement != null ? measurement.getId() : null)
                .category(request.getCategory())
                .otherCategoryText(request.getCategory() == ProactiveWorkCategory.OTHER
                        ? request.getOtherCategoryText().trim() : null)
                .subjectEmployeeId(subjectId)
                .loggedById(actor.getId())
                .title(request.getTitle().trim())
                .description(request.getDescription().trim())
                .valueStatement(blankToNull(request.getValueStatement()))
                .effortStartDate(start)
                .effortEndDate(end)
                .visibility(request.getVisibility() != null ? request.getVisibility() : ProactiveWorkVisibility.ORGANISATION)
                .isSeen(false)
                .isHighlighted(false)
                .endorsementCount(0)
                .commentCount(0)
                .isDeleted(false)
                .build();

        ProactiveWorkEntry saved = entryRepository.save(entry);
        auditService.record(saved.getId(), ProactiveWorkAuditActionType.CREATE, actor.getId(), null, snapshotOf(saved));
        return toResponse(saved, actor);
    }

    @Override
    @Transactional
    public ProactiveWorkEntryResponse update(Long id, ProactiveWorkEntryRequest request) {
        Employee actor = currentEmployeeOrThrow();
        ProactiveWorkEntry entry = findOrThrow(id);

        boolean isAuthor = actor.getId().equals(entry.getLoggedById());
        if (!isAuthor && actor.getRole() != Role.admin) {
            throw new AccessDeniedException("Only the author or an admin can edit this entry");
        }

        validateRequest(request);

        boolean locked = actor.getRole() != Role.admin
                && entry.getEndorsementCount() != null && entry.getEndorsementCount() > 0;
        if (locked && (entry.getCategory() != request.getCategory()
                || !entry.getTitle().equals(request.getTitle().trim()))) {
            throw new ProactiveWorkValidationException("title",
                    "Title and category lock once an entry has its first endorsement.");
        }

        KpiMeasurement measurement = null;
        if (request.getKpiMeasurementId() != null) {
            measurement = measurementRepository.findById(request.getKpiMeasurementId())
                    .orElseThrow(() -> new ResourceNotFoundException("KPI Measurement", request.getKpiMeasurementId()));
            if (!measurement.getSubjectEmployeeId().equals(entry.getSubjectEmployeeId())) {
                throw new ProactiveWorkValidationException(
                        "kpiMeasurementId", "This measurement doesn't belong to the credited employee.");
            }
        }

        LocalDate start = request.getEffortStartDate();
        LocalDate end = request.getEffortEndDate() != null ? request.getEffortEndDate() : start;
        if (end.isBefore(start)) {
            throw new ProactiveWorkValidationException("effortEndDate", "Last day can't be before the start date.");
        }

        Map<String, Object> oldValues = snapshotOf(entry);
        ProactiveWorkVisibility oldVisibility = entry.getVisibility();
        ProactiveWorkVisibility newVisibility = request.getVisibility() != null ? request.getVisibility() : oldVisibility;
        boolean visibilityChanged = newVisibility != oldVisibility;

        // Credit-to is never changed by an edit — re-crediting someone else is a bigger,
        // separate decision than fixing a typo in the description.
        if (!locked) {
            entry.setTitle(request.getTitle().trim());
            entry.setCategory(request.getCategory());
        }
        entry.setOtherCategoryText(request.getCategory() == ProactiveWorkCategory.OTHER
                ? request.getOtherCategoryText().trim() : null);
        entry.setDescription(request.getDescription().trim());
        entry.setValueStatement(blankToNull(request.getValueStatement()));
        entry.setEffortStartDate(start);
        entry.setEffortEndDate(end);
        entry.setKpiMeasurementId(measurement != null ? measurement.getId() : null);
        entry.setVisibility(newVisibility);
        entry.setEditedAt(LocalDateTime.now());

        ProactiveWorkEntry saved = entryRepository.save(entry);
        auditService.record(saved.getId(), ProactiveWorkAuditActionType.EDIT, actor.getId(), oldValues, snapshotOf(saved));
        if (visibilityChanged) {
            Map<String, Object> before = new LinkedHashMap<>();
            before.put("visibility", oldVisibility);
            Map<String, Object> after = new LinkedHashMap<>();
            after.put("visibility", newVisibility);
            auditService.record(saved.getId(), ProactiveWorkAuditActionType.VISIBILITY_CHANGE, actor.getId(), before, after);
        }
        return toDetailResponse(saved, actor);
    }

    @Override
    public List<ProactiveWorkEntryResponse> list(Integer subjectEmployeeIdFilter, Boolean unseenOnly, Boolean highlightedOnly) {
        Employee actor = currentEmployeeOrThrow();
        List<ProactiveWorkEntry> entries;

        if (actor.getRole() == Role.admin) {
            entries = subjectEmployeeIdFilter != null
                    ? entryRepository.findBySubjectEmployeeIdAndIsDeletedFalseOrderByEffortStartDateDescCreatedAtDesc(subjectEmployeeIdFilter)
                    : entryRepository.findByIsDeletedFalseOrderByEffortStartDateDescCreatedAtDesc();
        } else if (actor.getRole() == Role.manager) {
            List<Integer> scope = new ArrayList<>();
            scope.add(actor.getId());
            for (Employee report : employeeRepository.findByManager_Id(actor.getId())) {
                scope.add(report.getId());
            }
            if (subjectEmployeeIdFilter != null) {
                if (!scope.contains(subjectEmployeeIdFilter)) return List.of();
                scope = List.of(subjectEmployeeIdFilter);
            }
            entries = entryRepository.findBySubjectEmployeeIdInAndIsDeletedFalseOrderByEffortStartDateDescCreatedAtDesc(scope);
        } else if (actor.getRole() == Role.employee) {
            if (subjectEmployeeIdFilter != null && !subjectEmployeeIdFilter.equals(actor.getId())) {
                return List.of();
            }
            entries = entryRepository.findBySubjectOrLoggedByAndIsDeletedFalse(actor.getId());
        } else {
            throw new AccessDeniedException("Role not authorized to view proactive work");
        }

        return entries.stream()
                .filter(e -> unseenOnly == null || !unseenOnly || !Boolean.TRUE.equals(e.getIsSeen()))
                .filter(e -> highlightedOnly == null || !highlightedOnly || Boolean.TRUE.equals(e.getIsHighlighted()))
                .map(e -> toResponse(e, actor))
                .toList();
    }

    @Override
    public PagedResponse<ProactiveWorkEntryResponse> listEveryone(int page, int size, Boolean unseenOnly, Boolean highlightedOnly) {
        Employee actor = currentEmployeeOrThrow();
        Page<ProactiveWorkEntry> result = entryRepository.findEveryone(
                Boolean.TRUE.equals(unseenOnly), Boolean.TRUE.equals(highlightedOnly), PageRequest.of(page, size));
        return PagedResponse.<ProactiveWorkEntryResponse>builder()
                .content(result.getContent().stream().map(e -> toResponse(e, actor)).toList())
                .page(result.getNumber())
                .size(result.getSize())
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .build();
    }

    @Override
    @Transactional
    public ProactiveWorkEntryResponse getByIdAndMarkSeen(Long id) {
        Employee actor = currentEmployeeOrThrow();
        ProactiveWorkEntry entry = findOrThrow(id);
        if (!isVisible(actor, entry)) {
            throw new AccessDeniedException("Not authorized to view this entry");
        }

        // FR-PW-06, tightened for org-wide visibility: many managers can now open the same
        // entry, but only the SUBJECT's own manager (or an admin) counts as "noticed by someone
        // who can act on it" — not just any manager who happened to browse the Everyone feed.
        boolean isSubject = actor.getId().equals(entry.getSubjectEmployeeId());
        if (!isSubject && isSubjectsManagerOrAdmin(actor, entry.getSubjectEmployeeId())
                && !Boolean.TRUE.equals(entry.getIsSeen())) {
            Map<String, Object> oldValues = snapshotOf(entry);
            entry.setIsSeen(true);
            entry.setSeenAt(LocalDateTime.now());
            entry.setSeenById(actor.getId());
            entry = entryRepository.save(entry);
            auditService.record(entry.getId(), ProactiveWorkAuditActionType.SEEN, actor.getId(), oldValues, snapshotOf(entry));
        }
        return toDetailResponse(entry, actor);
    }

    @Override
    @Transactional
    public ProactiveWorkEntryResponse setHighlighted(Long id, boolean highlighted) {
        Employee actor = currentEmployeeOrThrow();
        // Cheap fail-fast: an employee can never highlight anything regardless of which entry,
        // so reject before touching the repository at all.
        if (actor.getRole() != Role.manager && actor.getRole() != Role.admin) {
            throw new AccessDeniedException("Only the subject's manager or an admin can highlight an entry");
        }
        ProactiveWorkEntry entry = findOrThrow(id);
        if (!isVisible(actor, entry)) {
            throw new AccessDeniedException("Not authorized to view this entry");
        }
        // Specifically the subject's own manager or an admin — not any manager who can merely
        // view an org-wide entry.
        if (!isSubjectsManagerOrAdmin(actor, entry.getSubjectEmployeeId())) {
            throw new AccessDeniedException("Only the subject's manager or an admin can highlight an entry");
        }

        Map<String, Object> oldValues = snapshotOf(entry);
        entry.setIsHighlighted(highlighted);
        entry.setHighlightedAt(highlighted ? LocalDateTime.now() : null);
        ProactiveWorkEntry saved = entryRepository.save(entry);
        auditService.record(saved.getId(),
                highlighted ? ProactiveWorkAuditActionType.HIGHLIGHT_ON : ProactiveWorkAuditActionType.HIGHLIGHT_OFF,
                actor.getId(), oldValues, snapshotOf(saved));
        return toDetailResponse(saved, actor);
    }

    @Override
    @Transactional
    public ProactiveWorkEntryResponse setEndorsed(Long id, boolean endorsed) {
        Employee actor = currentEmployeeOrThrow();
        ProactiveWorkEntry entry = findOrThrow(id);
        if (!isVisible(actor, entry)) {
            throw new AccessDeniedException("Not authorized to view this entry");
        }
        // The endorse control is absent entirely on a PRIVATE entry, for everyone — not just
        // greyed out for people who happen to be able to view it (subject's manager, admin).
        if (entry.getVisibility() == ProactiveWorkVisibility.PRIVATE) {
            throw new AccessDeniedException("Can't endorse a private entry");
        }
        if (actor.getId().equals(entry.getSubjectEmployeeId())) {
            throw new AccessDeniedException("Can't endorse your own entry");
        }

        Optional<ProactiveWorkEndorsement> existing = endorsementRepository.findByEntryIdAndEmployeeId(id, actor.getId());
        if (endorsed) {
            if (existing.isPresent()) {
                if (existing.get().getWithdrawnAt() != null) {
                    existing.get().setWithdrawnAt(null);
                    endorsementRepository.save(existing.get());
                }
            } else {
                ProactiveWorkEndorsement fresh = ProactiveWorkEndorsement.builder()
                        .entryId(id)
                        .employeeId(actor.getId())
                        .subjectEmployeeId(entry.getSubjectEmployeeId())
                        .build();
                endorsementRepository.save(fresh);
            }
        } else if (existing.isPresent() && existing.get().getWithdrawnAt() == null) {
            existing.get().setWithdrawnAt(LocalDateTime.now());
            endorsementRepository.save(existing.get());
        }

        entry.setEndorsementCount((int) endorsementRepository.countByEntryIdAndWithdrawnAtIsNull(id));
        ProactiveWorkEntry saved = entryRepository.save(entry);
        // Not audited — endorsements are already attributed, timestamped and never
        // hard-deleted; mirroring them into the audit table would double every write for no
        // extra evidence.
        return toDetailResponse(saved, actor);
    }

    @Override
    @Transactional
    public ProactiveWorkCommentResponse addComment(Long entryId, ProactiveWorkCommentRequest request) {
        Employee actor = currentEmployeeOrThrow();
        ProactiveWorkEntry entry = findOrThrow(entryId);
        if (!isVisible(actor, entry)) {
            throw new AccessDeniedException("Not authorized to view this entry");
        }
        if (entry.getVisibility() == ProactiveWorkVisibility.PRIVATE) {
            throw new AccessDeniedException("Can't comment on a private entry");
        }
        validateComment(request);

        ProactiveWorkComment comment = ProactiveWorkComment.builder()
                .entryId(entryId)
                .authorId(actor.getId())
                .body(request.getBody().trim())
                .isDeleted(false)
                .build();
        ProactiveWorkComment saved = commentRepository.save(comment);

        entry.setCommentCount((int) commentRepository.countByEntryIdAndIsDeletedFalse(entryId));
        entryRepository.save(entry);
        return toCommentResponse(saved);
    }

    @Override
    @Transactional
    public ProactiveWorkCommentResponse editComment(Long commentId, ProactiveWorkCommentRequest request) {
        Employee actor = currentEmployeeOrThrow();
        ProactiveWorkComment comment = commentRepository.findByIdAndIsDeletedFalse(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment", commentId));
        if (!comment.getAuthorId().equals(actor.getId())) {
            throw new AccessDeniedException("Only the comment's author can edit it");
        }
        validateComment(request);

        comment.setBody(request.getBody().trim());
        comment.setEditedAt(LocalDateTime.now());
        return toCommentResponse(commentRepository.save(comment));
    }

    @Override
    @Transactional
    public void deleteComment(Long commentId) {
        Employee actor = currentEmployeeOrThrow();
        ProactiveWorkComment comment = commentRepository.findByIdAndIsDeletedFalse(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment", commentId));
        boolean isAuthor = comment.getAuthorId().equals(actor.getId());
        if (!isAuthor && actor.getRole() != Role.admin) {
            throw new AccessDeniedException("Only the comment's author or an admin can delete it");
        }

        comment.setIsDeleted(true);
        commentRepository.save(comment);

        ProactiveWorkEntry entry = findOrThrow(comment.getEntryId());
        entry.setCommentCount((int) commentRepository.countByEntryIdAndIsDeletedFalse(comment.getEntryId()));
        entryRepository.save(entry);
    }

    @Override
    public Map<Long, List<ProactiveWorkEntrySummaryResponse>> findVisibleSummariesForMeasurements(Collection<Long> measurementIds) {
        if (measurementIds == null || measurementIds.isEmpty()) return Map.of();
        Employee actor = currentEmployeeOrThrow();

        List<ProactiveWorkEntry> entries = entryRepository.findByKpiMeasurementIdInAndIsDeletedFalse(measurementIds);
        Map<Long, List<ProactiveWorkEntrySummaryResponse>> byMeasurement = new HashMap<>();
        for (ProactiveWorkEntry e : entries) {
            if (!isVisible(actor, e)) continue;
            byMeasurement.computeIfAbsent(e.getKpiMeasurementId(), k -> new ArrayList<>()).add(toSummary(e));
        }
        return byMeasurement;
    }

    /* ---------- RBAC ---------- */

    /** Can the actor open/read this entry at all. ORGANISATION visibility makes this true for
     *  everyone — the entry's own visibility flag is what makes v2 different from v1, not role. */
    private boolean isVisible(Employee actor, ProactiveWorkEntry entry) {
        if (actor.getRole() == Role.admin) return true;
        if (entry.getVisibility() == ProactiveWorkVisibility.ORGANISATION) return true;
        if (actor.getId().equals(entry.getSubjectEmployeeId())) return true;
        if (actor.getId().equals(entry.getLoggedById())) return true;
        if (actor.getRole() == Role.manager) return isDirectReport(actor.getId(), entry.getSubjectEmployeeId());
        return false;
    }

    /** A stricter, visibility-independent check — deliberately NOT short-circuited by
     *  ORGANISATION visibility, since "can read it" and "is this person's own manager" are
     *  different questions once anyone at Vitec can read an org-wide entry. Backs seen-stamping
     *  and highlighting, both of which must stay scoped to the subject's real manager. */
    private boolean isSubjectsManagerOrAdmin(Employee actor, Integer subjectEmployeeId) {
        if (actor.getRole() == Role.admin) return true;
        return actor.getRole() == Role.manager && isDirectReport(actor.getId(), subjectEmployeeId);
    }

    private boolean isDirectReport(Integer managerId, Integer employeeId) {
        return employeeRepository.findById(employeeId)
                .map(e -> e.getManager() != null && managerId.equals(e.getManager().getId()))
                .orElse(false);
    }

    private boolean canViewMeasurement(Employee actor, KpiMeasurement measurement) {
        if (measurement == null) return false;
        if (actor.getRole() == Role.admin) return true;
        if (actor.getId().equals(measurement.getSubjectEmployeeId())) return true;
        if (measurement.getMeasuredBy() != null && actor.getId().equals(measurement.getMeasuredBy().getId())) return true;
        if (actor.getRole() == Role.manager) return isDirectReport(actor.getId(), measurement.getSubjectEmployeeId());
        return false;
    }

    private Employee currentEmployeeOrThrow() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new AccessDeniedException("Not authenticated");
        }
        return employeeRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new AccessDeniedException("Current user not found"));
    }

    /* ---------- validation ---------- */

    private void validateRequest(ProactiveWorkEntryRequest request) {
        Set<ConstraintViolation<ProactiveWorkEntryRequest>> violations = validator.validate(request);
        if (!violations.isEmpty()) {
            ConstraintViolation<ProactiveWorkEntryRequest> first = violations.iterator().next();
            throw new ProactiveWorkValidationException(first.getPropertyPath().toString(), first.getMessage());
        }
        if (request.getCategory() == ProactiveWorkCategory.OTHER
                && (request.getOtherCategoryText() == null || request.getOtherCategoryText().trim().isEmpty())) {
            throw new ProactiveWorkValidationException("otherCategoryText", "Tell us what kind of work this was.");
        }
        if (request.getCategory() != ProactiveWorkCategory.OTHER
                && request.getOtherCategoryText() != null && !request.getOtherCategoryText().trim().isEmpty()) {
            throw new ProactiveWorkValidationException("otherCategoryText", "Only set this when category is Other.");
        }
    }

    private void validateComment(ProactiveWorkCommentRequest request) {
        Set<ConstraintViolation<ProactiveWorkCommentRequest>> violations = validator.validate(request);
        if (!violations.isEmpty()) {
            ConstraintViolation<ProactiveWorkCommentRequest> first = violations.iterator().next();
            throw new ProactiveWorkValidationException(first.getPropertyPath().toString(), first.getMessage());
        }
    }

    private String blankToNull(String s) {
        if (s == null) return null;
        String trimmed = s.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    /* ---------- mapping ---------- */

    private ProactiveWorkEntry findOrThrow(Long id) {
        return entryRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("Proactive Work Entry", id));
    }

    private ProactiveWorkEntryType resolveEntryType(ProactiveWorkEntry e) {
        return e.getKpiMeasurementId() == null ? ProactiveWorkEntryType.STANDALONE : ProactiveWorkEntryType.KPI_LINKED;
    }

    private Map<String, Object> snapshotOf(ProactiveWorkEntry e) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("category", e.getCategory());
        m.put("otherCategoryText", e.getOtherCategoryText());
        m.put("subjectEmployeeId", e.getSubjectEmployeeId());
        m.put("title", e.getTitle());
        m.put("description", e.getDescription());
        m.put("valueStatement", e.getValueStatement());
        m.put("effortStartDate", e.getEffortStartDate());
        m.put("effortEndDate", e.getEffortEndDate());
        m.put("visibility", e.getVisibility());
        m.put("kpiMeasurementId", e.getKpiMeasurementId());
        m.put("isSeen", e.getIsSeen());
        m.put("seenAt", e.getSeenAt());
        m.put("seenById", e.getSeenById());
        m.put("isHighlighted", e.getIsHighlighted());
        m.put("highlightedAt", e.getHighlightedAt());
        return m;
    }

    private ProactiveWorkEntryResponse toResponse(ProactiveWorkEntry e, Employee actor) {
        Employee subject = employeeRepository.findById(e.getSubjectEmployeeId()).orElse(null);
        Employee loggedBy = employeeRepository.findById(e.getLoggedById()).orElse(null);
        KpiMeasurement measurement = e.getKpiMeasurementId() != null
                ? measurementRepository.findById(e.getKpiMeasurementId()).orElse(null) : null;
        // The KPI chip renders only for viewers already permitted to see that measurement — for
        // everyone else the whole triple is null, not just the display name, so the response
        // carries no trace that a link exists at all.
        boolean kpiVisible = measurement != null && canViewMeasurement(actor, measurement);
        String seenByName = e.getSeenById() != null
                ? EmployeeUtils.resolveName(employeeRepository.findById(e.getSeenById()).orElse(null)) : null;

        return ProactiveWorkEntryResponse.builder()
                .id(e.getId())
                .kpiMeasurementId(kpiVisible ? e.getKpiMeasurementId() : null)
                .kpiMetricName(kpiVisible ? measurement.getKpiMetric().getName() : null)
                .kpiMeasurementPeriodLabel(kpiVisible ? measurement.getMeasurementPeriodLabel() : null)
                .entryType(resolveEntryType(e))
                .category(e.getCategory())
                .otherCategoryText(e.getOtherCategoryText())
                .subjectEmployeeId(e.getSubjectEmployeeId())
                .subjectEmployeeName(EmployeeUtils.resolveName(subject))
                .loggedById(e.getLoggedById())
                .loggedByName(EmployeeUtils.resolveName(loggedBy))
                .title(e.getTitle())
                .description(e.getDescription())
                .valueStatement(e.getValueStatement())
                .effortStartDate(e.getEffortStartDate())
                .effortEndDate(e.getEffortEndDate())
                .visibility(e.getVisibility())
                .isSeen(e.getIsSeen())
                .seenAt(e.getSeenAt())
                .seenById(e.getSeenById())
                .seenByName(seenByName)
                .isHighlighted(e.getIsHighlighted())
                .highlightedAt(e.getHighlightedAt())
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
                .editedAt(e.getEditedAt())
                .endorsementCount(e.getEndorsementCount())
                .commentCount(e.getCommentCount())
                .build();
    }

    /** Adds the endorser roster, comment thread and endorsedByMe — only worth the extra
     *  queries when a single entry is actually being opened, not for every row of a list. */
    private ProactiveWorkEntryResponse toDetailResponse(ProactiveWorkEntry e, Employee actor) {
        ProactiveWorkEntryResponse response = toResponse(e, actor);

        List<ProactiveWorkEndorsement> active = endorsementRepository.findActiveByEntryId(e.getId());
        response.setEndorsedByMe(active.stream().anyMatch(en -> en.getEmployeeId().equals(actor.getId())));
        response.setEndorsers(active.stream()
                .map(en -> ProactiveWorkEndorserResponse.builder()
                        .id(en.getEmployeeId())
                        .name(EmployeeUtils.resolveName(employeeRepository.findById(en.getEmployeeId()).orElse(null)))
                        .build())
                .toList());

        List<ProactiveWorkComment> comments = commentRepository.findByEntryIdOrderByCreatedAtAsc(e.getId());
        response.setComments(comments.stream().map(this::toCommentResponse).toList());

        return response;
    }

    private ProactiveWorkCommentResponse toCommentResponse(ProactiveWorkComment c) {
        Employee author = employeeRepository.findById(c.getAuthorId()).orElse(null);
        boolean deleted = Boolean.TRUE.equals(c.getIsDeleted());
        return ProactiveWorkCommentResponse.builder()
                .id(c.getId())
                .entryId(c.getEntryId())
                .authorId(c.getAuthorId())
                .authorName(EmployeeUtils.resolveName(author))
                .body(deleted ? "Comment removed" : c.getBody())
                .createdAt(c.getCreatedAt())
                .editedAt(c.getEditedAt())
                .isDeleted(c.getIsDeleted())
                .build();
    }

    private ProactiveWorkEntrySummaryResponse toSummary(ProactiveWorkEntry e) {
        Employee subject = employeeRepository.findById(e.getSubjectEmployeeId()).orElse(null);
        Employee loggedBy = employeeRepository.findById(e.getLoggedById()).orElse(null);
        return ProactiveWorkEntrySummaryResponse.builder()
                .id(e.getId())
                .title(e.getTitle())
                .description(e.getDescription())
                .category(e.getCategory())
                .subjectEmployeeName(EmployeeUtils.resolveName(subject))
                .loggedByName(EmployeeUtils.resolveName(loggedBy))
                .effortStartDate(e.getEffortStartDate())
                .effortEndDate(e.getEffortEndDate())
                .isHighlighted(e.getIsHighlighted())
                .build();
    }
}

package com.kpi.service.impl;

import com.kpi.dto.request.ProactiveWorkEntryRequest;
import com.kpi.dto.response.ProactiveWorkEntryResponse;
import com.kpi.dto.response.ProactiveWorkEntrySummaryResponse;
import com.kpi.entity.Employee;
import com.kpi.entity.KpiMeasurement;
import com.kpi.entity.ProactiveWorkEntry;
import com.kpi.entity.enums.ProactiveWorkAuditActionType;
import com.kpi.entity.enums.ProactiveWorkCategory;
import com.kpi.entity.enums.ProactiveWorkEntryType;
import com.kpi.entity.enums.Role;
import com.kpi.exception.ProactiveWorkValidationException;
import com.kpi.exception.ResourceNotFoundException;
import com.kpi.repository.EmployeeRepository;
import com.kpi.repository.KpiMeasurementRepository;
import com.kpi.repository.ProactiveWorkEntryRepository;
import com.kpi.service.ProactiveWorkAuditService;
import com.kpi.service.ProactiveWorkService;
import com.kpi.util.EmployeeUtils;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
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
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProactiveWorkServiceImpl implements ProactiveWorkService {

    private final ProactiveWorkEntryRepository entryRepository;
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
            // other employee (a manager, a peer on another team, etc.), e.g. for team-support
            // style entries. Still must be a real employee.
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
            // UC-PW-01 Alt Flow A: "the system re-validates the subject before saving" — a
            // KPI-linked entry's subject must be the employee that measurement is actually about,
            // not whoever the client happened to send. The UI's KPI dropdown only ever offers the
            // credited employee's own measurements, but the server cannot trust that.
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
                .effortStartDate(start)
                .effortEndDate(end)
                .isSeen(false)
                .isHighlighted(false)
                .isDeleted(false)
                .build();

        ProactiveWorkEntry saved = entryRepository.save(entry);
        auditService.record(saved.getId(), ProactiveWorkAuditActionType.CREATE, actor.getId(), null, snapshotOf(saved));
        return toResponse(saved);
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
            // Now that an employee can credit someone else, their own list must also include
            // entries they logged for others — otherwise submitting one makes it vanish from
            // their own view the instant it's saved.
            entries = entryRepository.findBySubjectOrLoggedByAndIsDeletedFalse(actor.getId());
        } else {
            throw new AccessDeniedException("Role not authorized to view proactive work");
        }

        return entries.stream()
                .filter(e -> unseenOnly == null || !unseenOnly || !Boolean.TRUE.equals(e.getIsSeen()))
                .filter(e -> highlightedOnly == null || !highlightedOnly || Boolean.TRUE.equals(e.getIsHighlighted()))
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional
    public ProactiveWorkEntryResponse getByIdAndMarkSeen(Long id) {
        Employee actor = currentEmployeeOrThrow();
        ProactiveWorkEntry entry = findOrThrow(id);
        if (!isVisible(actor, entry.getSubjectEmployeeId(), entry.getLoggedById())) {
            throw new AccessDeniedException("Not authorized to view this entry");
        }

        // FR-PW-06: "the first time a manager or admin opens an entry" — explicitly gated on
        // role here, since isVisible() now also lets a plain employee view an entry they merely
        // logged for someone else, and that view must never count as the "manager/admin saw it"
        // signal.
        boolean isSubject = actor.getId().equals(entry.getSubjectEmployeeId());
        boolean canMarkSeen = !isSubject && (actor.getRole() == Role.manager || actor.getRole() == Role.admin);
        if (canMarkSeen && !Boolean.TRUE.equals(entry.getIsSeen())) {
            Map<String, Object> oldValues = snapshotOf(entry);
            entry.setIsSeen(true);
            entry.setSeenAt(LocalDateTime.now());
            entry.setSeenById(actor.getId());
            entry = entryRepository.save(entry);
            auditService.record(entry.getId(), ProactiveWorkAuditActionType.SEEN, actor.getId(), oldValues, snapshotOf(entry));
        }
        return toResponse(entry);
    }

    @Override
    @Transactional
    public ProactiveWorkEntryResponse setHighlighted(Long id, boolean highlighted) {
        Employee actor = currentEmployeeOrThrow();
        // BRD §8.3 RBAC matrix — Seen/Highlight: Employee = No, Manager = Yes (within scope),
        // Admin = Yes (all). An employee may not highlight even their own entry.
        if (actor.getRole() != Role.manager && actor.getRole() != Role.admin) {
            throw new AccessDeniedException("Only a manager or admin can highlight an entry");
        }

        ProactiveWorkEntry entry = findOrThrow(id);
        if (!isVisible(actor, entry.getSubjectEmployeeId(), entry.getLoggedById())) {
            throw new AccessDeniedException("Not authorized to view this entry");
        }

        Map<String, Object> oldValues = snapshotOf(entry);
        entry.setIsHighlighted(highlighted);
        entry.setHighlightedAt(highlighted ? LocalDateTime.now() : null);
        ProactiveWorkEntry saved = entryRepository.save(entry);
        auditService.record(saved.getId(),
                highlighted ? ProactiveWorkAuditActionType.HIGHLIGHT_ON : ProactiveWorkAuditActionType.HIGHLIGHT_OFF,
                actor.getId(), oldValues, snapshotOf(saved));
        return toResponse(saved);
    }

    @Override
    public Map<Long, List<ProactiveWorkEntrySummaryResponse>> findVisibleSummariesForMeasurements(Collection<Long> measurementIds) {
        if (measurementIds == null || measurementIds.isEmpty()) return Map.of();
        Employee actor = currentEmployeeOrThrow();

        List<ProactiveWorkEntry> entries = entryRepository.findByKpiMeasurementIdInAndIsDeletedFalse(measurementIds);
        Map<Long, List<ProactiveWorkEntrySummaryResponse>> byMeasurement = new HashMap<>();
        for (ProactiveWorkEntry e : entries) {
            if (!isVisible(actor, e.getSubjectEmployeeId(), e.getLoggedById())) continue;
            byMeasurement.computeIfAbsent(e.getKpiMeasurementId(), k -> new ArrayList<>()).add(toSummary(e));
        }
        return byMeasurement;
    }

    /* ---------- RBAC ---------- */

    private boolean isVisible(Employee actor, Integer subjectEmployeeId, Integer loggedById) {
        if (actor.getRole() == Role.admin) return true;
        if (actor.getId().equals(subjectEmployeeId)) return true;
        if (actor.getId().equals(loggedById)) return true;
        if (actor.getRole() == Role.manager) return isDirectReport(actor.getId(), subjectEmployeeId);
        return false;
    }

    private boolean isDirectReport(Integer managerId, Integer employeeId) {
        return employeeRepository.findById(employeeId)
                .map(e -> e.getManager() != null && managerId.equals(e.getManager().getId()))
                .orElse(false);
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
        m.put("effortStartDate", e.getEffortStartDate());
        m.put("effortEndDate", e.getEffortEndDate());
        m.put("kpiMeasurementId", e.getKpiMeasurementId());
        m.put("isSeen", e.getIsSeen());
        m.put("seenAt", e.getSeenAt());
        m.put("seenById", e.getSeenById());
        m.put("isHighlighted", e.getIsHighlighted());
        m.put("highlightedAt", e.getHighlightedAt());
        return m;
    }

    private ProactiveWorkEntryResponse toResponse(ProactiveWorkEntry e) {
        Employee subject = employeeRepository.findById(e.getSubjectEmployeeId()).orElse(null);
        Employee loggedBy = employeeRepository.findById(e.getLoggedById()).orElse(null);
        KpiMeasurement measurement = e.getKpiMeasurementId() != null
                ? measurementRepository.findById(e.getKpiMeasurementId()).orElse(null) : null;

        return ProactiveWorkEntryResponse.builder()
                .id(e.getId())
                .kpiMeasurementId(e.getKpiMeasurementId())
                .kpiMetricName(measurement != null ? measurement.getKpiMetric().getName() : null)
                .kpiMeasurementPeriodLabel(measurement != null ? measurement.getMeasurementPeriodLabel() : null)
                .entryType(resolveEntryType(e))
                .category(e.getCategory())
                .otherCategoryText(e.getOtherCategoryText())
                .subjectEmployeeId(e.getSubjectEmployeeId())
                .subjectEmployeeName(EmployeeUtils.resolveName(subject))
                .loggedById(e.getLoggedById())
                .loggedByName(EmployeeUtils.resolveName(loggedBy))
                .title(e.getTitle())
                .description(e.getDescription())
                .effortStartDate(e.getEffortStartDate())
                .effortEndDate(e.getEffortEndDate())
                .isSeen(e.getIsSeen())
                .seenAt(e.getSeenAt())
                .seenById(e.getSeenById())
                .isHighlighted(e.getIsHighlighted())
                .highlightedAt(e.getHighlightedAt())
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
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

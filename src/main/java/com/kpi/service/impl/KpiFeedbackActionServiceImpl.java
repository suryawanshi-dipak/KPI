package com.kpi.service.impl;

import com.kpi.dto.request.FeedbackVerificationRequest;
import com.kpi.dto.request.JiraStatusUpdateRequest;
import com.kpi.dto.request.KpiFeedbackActionRequest;
import com.kpi.dto.response.KpiFeedbackActionResponse;
import com.kpi.entity.Employee;
import com.kpi.entity.KpiFeedbackAction;
import com.kpi.entity.KpiFeedbackActionAudit;
import com.kpi.entity.KpiMeasurement;
import com.kpi.exception.BadRequestException;
import com.kpi.exception.ResourceNotFoundException;
import com.kpi.repository.EmployeeRepository;
import com.kpi.repository.KpiFeedbackActionAuditRepository;
import com.kpi.repository.KpiFeedbackActionRepository;
import com.kpi.repository.KpiMeasurementRepository;
import com.kpi.service.KpiFeedbackActionService;
import com.kpi.util.EmployeeUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Implements the feedback/remediation workflow while keeping database integrity checks
 * in one place. The entity deliberately stores IDs instead of JPA relationships, so
 * referenced measurements and employees are explicitly validated here.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class KpiFeedbackActionServiceImpl implements KpiFeedbackActionService {

    private final KpiFeedbackActionRepository feedbackActionRepository;
    private final KpiMeasurementRepository measurementRepository;
    private final EmployeeRepository employeeRepository;
    private final KpiFeedbackActionAuditRepository auditRepository;

    /** Returns all active feedback actions, ordered by their submission time. */
    @Override
    public List<KpiFeedbackActionResponse> getAll() {
        return feedbackActionRepository.findByIsDeletedFalseOrderBySubmittedAtDesc().stream()
                .map(this::toResponse)
                .toList();
    }

    /** Returns one active feedback action or a consistent 404 response. */
    @Override
    public KpiFeedbackActionResponse getById(Long id) {
        return toResponse(findOrThrow(id));
    }

    /** Returns all active actions raised for a particular KPI measurement. */
    @Override
    public List<KpiFeedbackActionResponse> getByKpiMeasurementId(Long kpiMeasurementId) {
        return feedbackActionRepository
                .findByKpiMeasurementIdAndIsDeletedFalseOrderBySubmittedAtDesc(kpiMeasurementId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    /** Returns all active actions that have the requested verification outcome. */
    @Override
    public List<KpiFeedbackActionResponse> getByVerificationResult(KpiFeedbackAction.VerificationResult verificationResult) {
        return feedbackActionRepository
                .findByVerificationResultAndIsDeletedFalseOrderBySubmittedAtDesc(verificationResult)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    /** Creates a remediation record after validating all supplied foreign-key-style IDs. */
    @Override
    @Transactional
    public KpiFeedbackActionResponse create(KpiFeedbackActionRequest request) {
        checkWriteAccess(request.getKpiMeasurementId(), "CREATE");

        // Reject if active feedback already exists for this measurement
        List<KpiFeedbackAction> existing = feedbackActionRepository
                .findByKpiMeasurementIdAndIsDeletedFalseOrderBySubmittedAtDesc(request.getKpiMeasurementId());
        if (!existing.isEmpty()) {
            throw new BadRequestException("An active feedback action already exists for this KPI measurement");
        }

        // Validate Jira issue key format if non-null
        validateJiraKey(request.getLinkedJiraIssueKey());

        validateRequestReferences(request, null);

        LocalDateTime now = LocalDateTime.now();
        Integer actorId = resolveCurrentUserEmployeeId();
        KpiFeedbackAction action = new KpiFeedbackAction();
        applyRequest(action, request);
        action.setSubmittedAt(request.getSubmittedAt() != null ? request.getSubmittedAt() : now);
        action.setCreatedAt(now);
        action.setUpdatedAt(now);
        // Use the authenticated employee for auditing; retain the submitter as a fallback for test/import flows.
        action.setCreatedBy(actorId != null ? actorId : request.getSubmittedBy());
        action.setUpdatedBy(actorId != null ? actorId : request.getSubmittedBy());
        action.setIsDeleted(false);

        KpiFeedbackAction saved = feedbackActionRepository.save(action);
        saveAudit(saved, "CREATE");

        return toResponse(saved);
    }

    /** Fully updates an active feedback action using the same validations as creation. */
    @Override
    @Transactional
    public KpiFeedbackActionResponse update(Long id, KpiFeedbackActionRequest request) {
        KpiFeedbackAction action = findOrThrow(id);
        checkWriteAccess(action.getKpiMeasurementId(), "UPDATE");

        // Validate Jira issue key format if non-null
        validateJiraKey(request.getLinkedJiraIssueKey());

        validateRequestReferences(request, id);

        applyRequest(action, request);
        action.setSubmittedAt(request.getSubmittedAt() != null ? request.getSubmittedAt() : action.getSubmittedAt());
        action.setUpdatedAt(LocalDateTime.now());
        action.setUpdatedBy(resolveCurrentUserEmployeeId());

        KpiFeedbackAction saved = feedbackActionRepository.save(action);
        saveAudit(saved, "UPDATE");

        return toResponse(saved);
    }

    /** Stores a Jira status snapshot without requiring a client to resubmit the complete action. */
    @Override
    @Transactional
    public KpiFeedbackActionResponse updateJiraStatus(Long id, JiraStatusUpdateRequest request) {
        KpiFeedbackAction action = findOrThrow(id);
        checkWriteAccess(action.getKpiMeasurementId(), "UPDATE_JIRA");

        action.setJiraStatusSnapshot(request.getJiraStatusSnapshot());
        action.setJiraStatusLastSyncedAt(
                request.getJiraStatusLastSyncedAt() != null ? request.getJiraStatusLastSyncedAt() : LocalDateTime.now());
        action.setJiraResolvedAt(request.getJiraResolvedAt());
        action.setJiraResolutionCategory(request.getJiraResolutionCategory());
        action.setUpdatedAt(LocalDateTime.now());
        action.setUpdatedBy(resolveCurrentUserEmployeeId());

        KpiFeedbackAction saved = feedbackActionRepository.save(action);
        saveAudit(saved, "JIRA_UPDATE");

        return toResponse(saved);
    }

    /** Records the post-remediation KPI verification result and optional evidence measurement. */
    @Override
    @Transactional
    public KpiFeedbackActionResponse recordVerification(Long id, FeedbackVerificationRequest request) {
        KpiFeedbackAction action = findOrThrow(id);
        checkWriteAccess(action.getKpiMeasurementId(), "VERIFY");

        validateVerificationReference(request.getVerificationResult(), request.getVerificationKpiMeasurementId());

        action.setVerificationResult(request.getVerificationResult());
        action.setVerificationKpiMeasurementId(request.getVerificationKpiMeasurementId());
        action.setVerificationCheckedAt(
                request.getVerificationCheckedAt() != null ? request.getVerificationCheckedAt() : LocalDateTime.now());
        action.setUpdatedAt(LocalDateTime.now());
        action.setUpdatedBy(resolveCurrentUserEmployeeId());

        KpiFeedbackAction saved = feedbackActionRepository.save(action);
        saveAudit(saved, "VERIFY");

        return toResponse(saved);
    }

    /** Soft deletes the action so remediation history remains available in the database. */
    @Override
    @Transactional
    public void delete(Long id) {
        KpiFeedbackAction action = findOrThrow(id);
        checkWriteAccess(action.getKpiMeasurementId(), "DELETE");

        action.setIsDeleted(true);
        action.setUpdatedAt(LocalDateTime.now());
        action.setUpdatedBy(resolveCurrentUserEmployeeId());

        KpiFeedbackAction saved = feedbackActionRepository.save(action);
        saveAudit(saved, "DELETE");
    }

    /** Helper to validate Jira Issue Key regex pattern */
    private void validateJiraKey(String key) {
        if (key != null && !key.trim().isEmpty()) {
            if (!key.matches("^[A-Z]+-\\d+$")) {
                throw new BadRequestException("Invalid Jira issue key format");
            }
        }
    }

    /** Helper to check RBAC write access for feedback actions */
    private void checkWriteAccess(Long measurementId, String operation) {
        KpiMeasurement measurement = measurementRepository.findById(measurementId)
                .orElseThrow(() -> new ResourceNotFoundException("KPI Measurement", measurementId));

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new AccessDeniedException("Not authenticated");
        }
        String email = authentication.getName();
        Employee currentUser = employeeRepository.findByEmail(email)
                .orElseThrow(() -> new AccessDeniedException("Current user not found"));

        if (currentUser.getRole() == com.kpi.entity.enums.Role.admin) {
            return; // Admin unrestricted
        }

        if (currentUser.getRole() == com.kpi.entity.enums.Role.hr) {
            throw new AccessDeniedException("HR role is read-only");
        }

        if (currentUser.getRole() == com.kpi.entity.enums.Role.employee) {
            if (!currentUser.getId().equals(measurement.getSubjectEmployeeId())) {
                throw new AccessDeniedException("Employees can only submit/edit feedback for their own measurements");
            }
        } else if (currentUser.getRole() == com.kpi.entity.enums.Role.manager) {
            if (currentUser.getId().equals(measurement.getSubjectEmployeeId())) {
                return;
            }
            Employee subjectEmp = employeeRepository.findById(measurement.getSubjectEmployeeId()).orElse(null);
            boolean isDirectReport = subjectEmp != null && subjectEmp.getManager() != null && currentUser.getId().equals(subjectEmp.getManager().getId());
            if (!isDirectReport) {
                throw new AccessDeniedException("Managers can only submit/edit feedback for their direct reports' measurements");
            }
        } else {
            throw new AccessDeniedException("Role not authorized");
        }
    }

    /** Helper to write audit snapshots */
    private void saveAudit(KpiFeedbackAction action, String actionType) {
        KpiFeedbackActionAudit audit = new KpiFeedbackActionAudit();
        audit.setKpiFeedbackActionId(action.getId());
        audit.setRootCauseSummary(action.getRootCauseSummary());
        audit.setLinkedJiraIssueKey(action.getLinkedJiraIssueKey());
        audit.setActionType(actionType);
        audit.setChangedBy(resolveCurrentUserEmployeeId());
        audit.setChangedAt(LocalDateTime.now());
        auditRepository.save(audit);
    }

    /** Copies the editable full-request fields to an existing or new entity. */
    private void applyRequest(KpiFeedbackAction action, KpiFeedbackActionRequest request) {
        action.setKpiMeasurementId(request.getKpiMeasurementId());
        action.setRootCauseSummary(request.getRootCauseSummary().trim());
        action.setLinkedJiraIssueKey(request.getLinkedJiraIssueKey());
        action.setSubmittedBy(request.getSubmittedBy());
        action.setJiraStatusSnapshot(request.getJiraStatusSnapshot());
        action.setJiraStatusLastSyncedAt(request.getJiraStatusLastSyncedAt());
        action.setJiraResolvedAt(request.getJiraResolvedAt());
        action.setJiraResolutionCategory(request.getJiraResolutionCategory());
        action.setVerificationResult(request.getVerificationResult());
        action.setVerificationKpiMeasurementId(request.getVerificationKpiMeasurementId());
        action.setVerificationCheckedAt(request.getVerificationCheckedAt());
        action.setRelatedPreviousFeedbackId(request.getRelatedPreviousFeedbackId());
    }

    /** Verifies all IDs in a create/update request before any data is persisted. */
    private void validateRequestReferences(KpiFeedbackActionRequest request, Long currentActionId) {
        validateActiveMeasurement(request.getKpiMeasurementId(), "KPI Measurement");
        validateEmployee(request.getSubmittedBy());
        validateVerificationReference(request.getVerificationResult(), request.getVerificationKpiMeasurementId());

        if (request.getRelatedPreviousFeedbackId() != null) {
            if (request.getRelatedPreviousFeedbackId().equals(currentActionId)) {
                throw new BadRequestException("A feedback action cannot reference itself as previous feedback");
            }
            findOrThrow(request.getRelatedPreviousFeedbackId());
        }
    }

    /** Requires a measurement for outcomes that claim the KPI was checked and verifies its activity. */
    private void validateVerificationReference(KpiFeedbackAction.VerificationResult result, Long measurementId) {
        boolean evidenceRequired = result == KpiFeedbackAction.VerificationResult.improved
                || result == KpiFeedbackAction.VerificationResult.not_improved;
        if (evidenceRequired && measurementId == null) {
            throw new BadRequestException("Verification KPI measurement is required for an improved or not_improved result");
        }
        if (measurementId != null) {
            validateActiveMeasurement(measurementId, "Verification KPI Measurement");
        }
    }

    /** Ensures a referenced measurement exists and has not been soft deleted. */
    private void validateActiveMeasurement(Long id, String resourceName) {
        KpiMeasurement measurement = measurementRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(resourceName, id));
        if (Boolean.TRUE.equals(measurement.getIsDeleted())) {
            throw new ResourceNotFoundException(resourceName, id);
        }
    }

    /** Ensures a submitted-by employee is a valid employee record. */
    private void validateEmployee(Integer employeeId) {
        if (!employeeRepository.existsById(employeeId)) {
            throw new ResourceNotFoundException("Employee", employeeId);
        }
    }

    /** Returns an active action, intentionally treating soft-deleted IDs as not found. */
    private KpiFeedbackAction findOrThrow(Long id) {
        return feedbackActionRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("KPI Feedback Action", id));
    }

    /** Resolves the logged-in employee for audit columns without coupling the API to JWT internals. */
    private Integer resolveCurrentUserEmployeeId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }
        return employeeRepository.findByEmail(authentication.getName())
                .map(Employee::getId)
                .orElse(null);
    }

    /** Converts the persistence entity into a Postman-friendly response payload. */
    private KpiFeedbackActionResponse toResponse(KpiFeedbackAction action) {
        String submittedByName = employeeRepository.findById(action.getSubmittedBy())
                .map(EmployeeUtils::resolveName)
                .orElse(null);

        return KpiFeedbackActionResponse.builder()
                .id(action.getId())
                .kpiMeasurementId(action.getKpiMeasurementId())
                .rootCauseSummary(action.getRootCauseSummary())
                .linkedJiraIssueKey(action.getLinkedJiraIssueKey())
                .submittedBy(action.getSubmittedBy())
                .submittedByName(submittedByName)
                .submittedAt(action.getSubmittedAt())
                .jiraStatusSnapshot(action.getJiraStatusSnapshot())
                .jiraStatusLastSyncedAt(action.getJiraStatusLastSyncedAt())
                .jiraResolvedAt(action.getJiraResolvedAt())
                .jiraResolutionCategory(action.getJiraResolutionCategory())
                .verificationResult(action.getVerificationResult())
                .verificationKpiMeasurementId(action.getVerificationKpiMeasurementId())
                .verificationCheckedAt(action.getVerificationCheckedAt())
                .relatedPreviousFeedbackId(action.getRelatedPreviousFeedbackId())
                .createdAt(action.getCreatedAt())
                .updatedAt(action.getUpdatedAt())
                .createdBy(action.getCreatedBy())
                .updatedBy(action.getUpdatedBy())
                .build();
    }
}


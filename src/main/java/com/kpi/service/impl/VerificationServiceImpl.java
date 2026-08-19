package com.kpi.service.impl;

import com.kpi.entity.KpiFeedbackAction;
import com.kpi.entity.KpiFeedbackAction.VerificationResult;
import com.kpi.entity.KpiFeedbackActionAudit;
import com.kpi.entity.KpiMeasurement;
import com.kpi.entity.enums.MeasurementStatus;
import com.kpi.repository.KpiFeedbackActionAuditRepository;
import com.kpi.repository.KpiFeedbackActionRepository;
import com.kpi.repository.KpiMeasurementRepository;
import com.kpi.service.VerificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class VerificationServiceImpl implements VerificationService {

    private static final Logger log = LoggerFactory.getLogger(VerificationServiceImpl.class);

    private final KpiMeasurementRepository measurementRepository;
    private final KpiFeedbackActionRepository feedbackActionRepository;
    private final KpiFeedbackActionAuditRepository auditRepository;

    public VerificationServiceImpl(KpiMeasurementRepository measurementRepository,
                                   KpiFeedbackActionRepository feedbackActionRepository,
                                   KpiFeedbackActionAuditRepository auditRepository) {
        this.measurementRepository = measurementRepository;
        this.feedbackActionRepository = feedbackActionRepository;
        this.auditRepository = auditRepository;
    }

    @org.springframework.scheduling.annotation.Async
    @org.springframework.transaction.event.TransactionalEventListener(phase = org.springframework.transaction.event.TransactionPhase.AFTER_COMMIT)
    public void handleMeasurementCreated(com.kpi.event.KpiMeasurementCreatedEvent event) {
        log.info("Transactional event listener caught measurement event for id: {}", event.getMeasurementId());
        verifyMeasurement(event.getMeasurementId());
    }


    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void verifyMeasurement(Long measurementId) {
        log.info("Starting verification for measurement id: {}", measurementId);
        KpiMeasurement newMeasurement = measurementRepository.findById(measurementId).orElse(null);
        if (newMeasurement == null) {
            log.warn("Measurement not found for verification: {}", measurementId);
            return;
        }

        if (Boolean.TRUE.equals(newMeasurement.getIsDeleted()) || Boolean.TRUE.equals(newMeasurement.getIsCorrected())) {
            log.info("Measurement {} is deleted or corrected, skipping verification", measurementId);
            return;
        }

        if (newMeasurement.getStatus() == MeasurementStatus.unknown || Boolean.TRUE.equals(newMeasurement.getIsPending())) {
            log.info("Measurement {} is unknown or pending, skipping verification comparison", measurementId);
            return;
        }

        // Look up prior fixed-but-unverified feedback actions
        List<KpiFeedbackAction> unverifiedActions = feedbackActionRepository.findResolvedAndUnverified(
                newMeasurement.getKpiMetric().getId(),
                newMeasurement.getSubjectEmployeeId(),
                newMeasurement.getPeriodStartDate(),
                KpiFeedbackAction.JiraResolutionCategory.fixed,
                KpiFeedbackAction.VerificationResult.pending
        );

        log.info("Found {} unverified actions matching metric: {}, subject employee: {}, date before: {}",
                unverifiedActions.size(),
                newMeasurement.getKpiMetric().getId(),
                newMeasurement.getSubjectEmployeeId(),
                newMeasurement.getPeriodStartDate());

        for (KpiFeedbackAction action : unverifiedActions) {
            Map<String, Object> oldValues = snapshotOf(action);
            KpiMeasurement priorMeasurement = measurementRepository.findById(action.getKpiMeasurementId()).orElse(null);
            if (priorMeasurement == null) {
                continue;
            }

            // Verify period matching and sequencing conditions
            if (priorMeasurement.getMeasurementPeriodType() != newMeasurement.getMeasurementPeriodType()) {
                continue;
            }
            if (!newMeasurement.getPeriodStartDate().isAfter(priorMeasurement.getPeriodEndDate())) {
                continue;
            }
            if (Boolean.TRUE.equals(priorMeasurement.getIsDeleted()) || Boolean.TRUE.equals(priorMeasurement.getIsCorrected())) {
                continue;
            }
            if (priorMeasurement.getStatus() == MeasurementStatus.unknown) {
                continue;
            }

            // Compare status ranks
            int priorRank = getStatusRank(priorMeasurement.getStatus());
            int newRank = getStatusRank(newMeasurement.getStatus());

            if (newRank < priorRank) {
                action.setVerificationResult(VerificationResult.improved);
            } else {
                action.setVerificationResult(VerificationResult.not_improved);
            }

            action.setVerificationKpiMeasurementId(newMeasurement.getId());
            action.setVerificationCheckedAt(LocalDateTime.now());
            action.setUpdatedAt(LocalDateTime.now());
            // The audit table requires a non-null actor, so retain the employee who last updated the action.
            Integer changedBy = action.getUpdatedBy() != null ? action.getUpdatedBy() : action.getCreatedBy();
            action.setUpdatedBy(changedBy);

            feedbackActionRepository.save(action);
            log.info("Action {} verified as {}", action.getId(), action.getVerificationResult());

            if (changedBy == null) {
                throw new IllegalStateException("Cannot audit an automated verification without an employee ID");
            }

            // Write an audit snapshot using the database table's JSON columns.
            KpiFeedbackActionAudit audit = new KpiFeedbackActionAudit();
            audit.setFeedbackActionId(action.getId());
            audit.setOldValues(oldValues);
            audit.setNewValues(snapshotOf(action));
            audit.setChangeType(KpiFeedbackActionAudit.ChangeType.VERIFICATION);
            audit.setChangedBy(changedBy);
            audit.setChangedAt(LocalDateTime.now());
            auditRepository.save(audit);
        }
    }

    private Map<String, Object> snapshotOf(KpiFeedbackAction action) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("kpiMeasurementId", action.getKpiMeasurementId());
        snapshot.put("rootCauseSummary", action.getRootCauseSummary());
        snapshot.put("linkedJiraIssueKey", action.getLinkedJiraIssueKey());
        snapshot.put("submittedBy", action.getSubmittedBy());
        snapshot.put("submittedAt", action.getSubmittedAt());
        snapshot.put("jiraStatusSnapshot", action.getJiraStatusSnapshot());
        snapshot.put("jiraStatusLastSyncedAt", action.getJiraStatusLastSyncedAt());
        snapshot.put("jiraResolvedAt", action.getJiraResolvedAt());
        snapshot.put("jiraResolutionCategory", action.getJiraResolutionCategory());
        snapshot.put("verificationResult", action.getVerificationResult());
        snapshot.put("verificationKpiMeasurementId", action.getVerificationKpiMeasurementId());
        snapshot.put("verificationCheckedAt", action.getVerificationCheckedAt());
        snapshot.put("relatedPreviousFeedbackId", action.getRelatedPreviousFeedbackId());
        snapshot.put("isDeleted", action.getIsDeleted());
        return snapshot;
    }

    private int getStatusRank(MeasurementStatus status) {
        switch (status) {
            case green:
                return 0;
            case amber:
                return 1;
            case red:
                return 2;
            case critical:
                return 3;
            default:
                throw new IllegalArgumentException("Unknown status rank for status: " + status);
        }
    }
}

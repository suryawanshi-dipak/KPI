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
import java.util.List;

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
            // System-generated stamps can leave updated_by NULL to distinguish from human edits
            action.setUpdatedBy(null);

            feedbackActionRepository.save(action);
            log.info("Action {} verified as {}", action.getId(), action.getVerificationResult());

            // Write an audit snapshot
            KpiFeedbackActionAudit audit = new KpiFeedbackActionAudit();
            audit.setKpiFeedbackActionId(action.getId());
            audit.setRootCauseSummary(action.getRootCauseSummary());
            audit.setLinkedJiraIssueKey(action.getLinkedJiraIssueKey());
            audit.setActionType("SYSTEM_VERIFY");
            audit.setChangedBy(null);
            audit.setChangedAt(LocalDateTime.now());
            auditRepository.save(audit);
        }
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

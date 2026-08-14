package com.kpi.repository;

import com.kpi.entity.KpiFeedbackAction;
import com.kpi.entity.KpiFeedbackAction.VerificationResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/** Persistence access for feedback/remediation actions; all reads exclude soft-deleted rows. */
public interface KpiFeedbackActionRepository extends JpaRepository<KpiFeedbackAction, Long> {

    /** Returns active actions newest first for the feedback/remediation work queue. */
    List<KpiFeedbackAction> findByIsDeletedFalseOrderBySubmittedAtDesc();

    /** Returns active actions attached to one KPI measurement. */
    List<KpiFeedbackAction> findByKpiMeasurementIdAndIsDeletedFalseOrderBySubmittedAtDesc(Long kpiMeasurementId);

    /** Returns active actions in a particular verification state. */
    List<KpiFeedbackAction> findByVerificationResultAndIsDeletedFalseOrderBySubmittedAtDesc(VerificationResult verificationResult);

    /** Retrieves one active action while hiding rows previously soft deleted. */
    Optional<KpiFeedbackAction> findByIdAndIsDeletedFalse(Long id);
}

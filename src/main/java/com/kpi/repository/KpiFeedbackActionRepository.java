package com.kpi.repository;

import com.kpi.entity.KpiFeedbackAction;
import com.kpi.entity.KpiFeedbackAction.VerificationResult;
import org.springframework.data.jpa.repository.JpaRepository;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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

    /** Finds resolved but not yet verified feedback actions for a given metric and subject employee. */
    @Query("SELECT fa FROM KpiFeedbackAction fa JOIN KpiMeasurement m ON fa.kpiMeasurementId = m.id " +
           "WHERE fa.isDeleted = false " +
           "AND fa.jiraResolutionCategory = :jiraResolutionCategory " +
           "AND (fa.verificationResult = :verificationResult OR fa.verificationResult IS NULL) " +
           "AND m.kpiMetric.id = :kpiMetricId " +
           "AND m.subjectEmployeeId = :subjectEmployeeId " +
           "AND m.periodStartDate < :periodStartDate")
    List<KpiFeedbackAction> findResolvedAndUnverified(
            @Param("kpiMetricId") Integer kpiMetricId,
            @Param("subjectEmployeeId") Integer subjectEmployeeId,
            @Param("periodStartDate") java.time.LocalDate periodStartDate,
            @Param("jiraResolutionCategory") KpiFeedbackAction.JiraResolutionCategory jiraResolutionCategory,
            @Param("verificationResult") KpiFeedbackAction.VerificationResult verificationResult);
}



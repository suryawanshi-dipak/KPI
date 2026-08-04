package com.kpi.service.impl;

import com.kpi.dto.response.ExecutiveSummaryResponse;
import com.kpi.dto.response.KpiHealthReportResponse;
import com.kpi.entity.*;
import com.kpi.entity.enums.Direction;
import com.kpi.entity.enums.MeasurementStatus;
import com.kpi.repository.*;
import com.kpi.service.ReportService;
import com.kpi.util.EmployeeUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Service implementation for compiling KPI and KRA reports.
 * Employs assignee-weighted score averaging and custom status threshold logic.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReportServiceImpl implements ReportService {

    private final KraAreaRepository kraAreaRepository;
    private final KpiMetricRepository kpiMetricRepository;
    private final KpiEmployeeAssignmentRepository kpiEmployeeAssignmentRepository;
    private final KpiMeasurementRepository kpiMeasurementRepository;

    @Override
    public List<String> getUniquePeriodLabels() {
        // Fetch sorted distinct period labels currently present in logged measurements
        return kpiMeasurementRepository.findDistinctPeriodLabels();
    }

    @Override
    public ExecutiveSummaryResponse getExecutiveSummary(String periodLabel) {
        // 1. Fetch active KRA Areas
        List<KraArea> kraAreas = kraAreaRepository.findAllByIsDeletedFalseAndIsActiveTrueOrderBySortOrderAsc();

        // 2. Fetch active KPI Metrics
        List<KpiMetric> kpis = kpiMetricRepository.findAllActiveWithKraArea();

        // 3. Fetch all active KPI employee assignments
        List<KpiEmployeeAssignment> allAssignments = kpiEmployeeAssignmentRepository.findAllWithDetails();

        // 4. Fetch all measurements logged for this period
        List<KpiMeasurement> allMeasurements = kpiMeasurementRepository.findByMeasurementPeriodLabelWithDetails(periodLabel);

        // Group assignments and measurements by KPI ID for efficient lookup
        Map<Integer, List<KpiEmployeeAssignment>> assignmentsByKpi = allAssignments.stream()
                .filter(a -> !a.getIsDeleted())
                .collect(Collectors.groupingBy(a -> a.getKpiMetric().getId()));

        Map<Integer, List<KpiMeasurement>> measurementsByKpi = allMeasurements.stream()
                .filter(m -> !m.getIsDeleted())
                .collect(Collectors.groupingBy(m -> m.getKpiMetric().getId()));

        // Maps to hold final KPI scores and computed statuses
        Map<Integer, BigDecimal> kpiScores = new HashMap<>();
        Map<Integer, MeasurementStatus> kpiStatuses = new HashMap<>();

        // Helper list to collect critical watchlist items
        List<ExecutiveSummaryResponse.CriticalWatchlistDto> criticalWatchlist = new ArrayList<>();

        // Helper list to collect missing/pending measurements
        List<ExecutiveSummaryResponse.PendingMeasurementDto> pendingMeasurements = new ArrayList<>();

        // Compute overall scores and status for each active KPI metric
        for (KpiMetric kpi : kpis) {
            List<KpiEmployeeAssignment> assignments = assignmentsByKpi.getOrDefault(kpi.getId(), Collections.emptyList());
            List<KpiMeasurement> measurements = measurementsByKpi.getOrDefault(kpi.getId(), Collections.emptyList());

            // 1. Calculate overall KPI score: average of assignee-level averages
            BigDecimal overallKpiScore = calculateAssigneeBasedOverallKpiScore(kpi, assignments, measurements);
            
            if (overallKpiScore != null) {
                kpiScores.put(kpi.getId(), overallKpiScore);
                MeasurementStatus status = computeStatus(overallKpiScore, kpi.getDirection(), kpi.getTargetValue(), kpi.getWarnThreshold(), kpi.getCriticalThreshold());
                kpiStatuses.put(kpi.getId(), status);
            } else {
                kpiStatuses.put(kpi.getId(), MeasurementStatus.unknown);
            }

            // 2. Identify Pending / Missing Measurements per Assignee
            for (KpiEmployeeAssignment assignment : assignments) {
                Employee assignee = assignment.getEmployee();
                
                // Look for completed measurements by this specific assignee in the period
                boolean hasCompleted = measurements.stream()
                        .anyMatch(m -> m.getMeasuredBy().getId().equals(assignee.getId()) 
                                && !m.getIsPending() 
                                && !m.getIsCorrected());

                if (!hasCompleted) {
                    // Check if they recorded a pending entry instead
                    Optional<KpiMeasurement> pendingOpt = measurements.stream()
                            .filter(m -> m.getMeasuredBy().getId().equals(assignee.getId()) && m.getIsPending())
                            .findFirst();

                    String reason = pendingOpt.map(m -> m.getPendingReason() != null ? m.getPendingReason() : "Pending")
                            .orElse("No measurement recorded yet");

                    pendingMeasurements.add(ExecutiveSummaryResponse.PendingMeasurementDto.builder()
                            .kpiName(kpi.getName())
                            .assigneeName(EmployeeUtils.resolveName(assignee))
                            .reason(reason)
                            .build());
                }
            }

            // 3. Populate Critical Watchlist for Red/Critical measurements
            for (KpiMeasurement m : measurements) {
                if (!m.getIsPending() && !m.getIsCorrected() && (m.getStatus() == MeasurementStatus.red || m.getStatus() == MeasurementStatus.critical)) {
                    criticalWatchlist.add(ExecutiveSummaryResponse.CriticalWatchlistDto.builder()
                            .kpiName(kpi.getName())
                            .assigneeName(EmployeeUtils.resolveName(m.getMeasuredBy()))
                            .measuredValue(m.getMeasuredValue())
                            .targetValue(kpi.getTargetValue())
                            .postAction(m.getPostAction() != null ? m.getPostAction() : "No post-action recorded")
                            .status(m.getStatus().name())
                            .build());
                }
            }
        }

        // Compute Org-Wide Status Distribution Counts
        Map<String, Long> statusDistribution = new HashMap<>();
        for (MeasurementStatus status : MeasurementStatus.values()) {
            statusDistribution.put(status.name(), 0L);
        }
        kpiStatuses.values().forEach(status -> 
            statusDistribution.put(status.name(), statusDistribution.getOrDefault(status.name(), 0L) + 1)
        );

        // Count measured KPIs (KPIs with at least one non-pending, non-corrected value)
        int measuredKpis = (int) kpiScores.size();

        // Compile KRA Summaries
        List<ExecutiveSummaryResponse.KraSummaryDto> kraSummaries = new ArrayList<>();
        for (KraArea kra : kraAreas) {
            // Find active KPIs linked to this KRA
            List<KpiMetric> kraKpis = kpis.stream()
                    .filter(k -> k.getKraArea().getId().equals(kra.getId()))
                    .toList();

            int totalKpis = kraKpis.size();

            // Sum up the number of assignees assigned to each KPI linked under this KRA area
            int totalAssignees = 0;
            List<BigDecimal> activeKpiScores = new ArrayList<>();

            for (KpiMetric kpi : kraKpis) {
                List<KpiEmployeeAssignment> assignments = assignmentsByKpi.getOrDefault(kpi.getId(), Collections.emptyList());
                totalAssignees += assignments.size();

                BigDecimal score = kpiScores.get(kpi.getId());
                if (score != null) {
                    activeKpiScores.add(score);
                }
            }

            // Overall KRA score is the mathematical average of the overall scores of the linked KPIs
            BigDecimal overallKraScore = null;
            if (!activeKpiScores.isEmpty()) {
                BigDecimal sum = BigDecimal.ZERO;
                for (BigDecimal score : activeKpiScores) {
                    sum = sum.add(score);
                }
                overallKraScore = sum.divide(BigDecimal.valueOf(activeKpiScores.size()), 4, RoundingMode.HALF_UP);
            }

            kraSummaries.add(ExecutiveSummaryResponse.KraSummaryDto.builder()
                    .kraAreaId(kra.getId())
                    .kraAreaName(kra.getAreaName())
                    .totalKpis(totalKpis)
                    .totalAssignees(totalAssignees)
                    .overallScore(overallKraScore)
                    .build());
        }

        return ExecutiveSummaryResponse.builder()
                .statusDistribution(statusDistribution)
                .totalKpis(kpis.size())
                .measuredKpis(measuredKpis)
                .kraSummaries(kraSummaries)
                .pendingMeasurements(pendingMeasurements)
                .criticalWatchlist(criticalWatchlist)
                .build();
    }

    @Override
    public KpiHealthReportResponse getKpiHealthReport(String periodLabel) {
        // Fetch database sources
        List<KraArea> kraAreas = kraAreaRepository.findAllByIsDeletedFalseAndIsActiveTrueOrderBySortOrderAsc();
        List<KpiMetric> kpis = kpiMetricRepository.findAllActiveWithKraArea();
        List<KpiEmployeeAssignment> allAssignments = kpiEmployeeAssignmentRepository.findAllWithDetails();
        List<KpiMeasurement> allMeasurements = kpiMeasurementRepository.findByMeasurementPeriodLabelWithDetails(periodLabel);

        // Map data structures for lookup
        Map<Integer, List<KpiEmployeeAssignment>> assignmentsByKpi = allAssignments.stream()
                .filter(a -> !a.getIsDeleted())
                .collect(Collectors.groupingBy(a -> a.getKpiMetric().getId()));

        Map<Integer, List<KpiMeasurement>> measurementsByKpi = allMeasurements.stream()
                .filter(m -> !m.getIsDeleted())
                .collect(Collectors.groupingBy(m -> m.getKpiMetric().getId()));

        List<KpiHealthReportResponse.KraHealthDto> kraHealths = new ArrayList<>();

        for (KraArea kra : kraAreas) {
            List<KpiMetric> kraKpis = kpis.stream()
                    .filter(k -> k.getKraArea().getId().equals(kra.getId()))
                    .toList();

            List<KpiHealthReportResponse.KpiHealthDto> kpiHealths = new ArrayList<>();

            for (KpiMetric kpi : kraKpis) {
                List<KpiEmployeeAssignment> assignments = assignmentsByKpi.getOrDefault(kpi.getId(), Collections.emptyList());
                List<KpiMeasurement> measurements = measurementsByKpi.getOrDefault(kpi.getId(), Collections.emptyList());

                // Compute KPI Score: average of assignee average logs
                BigDecimal overallScore = calculateAssigneeBasedOverallKpiScore(kpi, assignments, measurements);
                
                // Compute KPI Status based on computed score
                MeasurementStatus status = computeStatus(overallScore, kpi.getDirection(), kpi.getTargetValue(), kpi.getWarnThreshold(), kpi.getCriticalThreshold());

                // Build Individual Measurement List
                List<KpiHealthReportResponse.KpiHealthMeasurementDto> measurementDtos = measurements.stream()
                        .map(m -> KpiHealthReportResponse.KpiHealthMeasurementDto.builder()
                                .assigneeName(EmployeeUtils.resolveName(m.getMeasuredBy()))
                                .measuredValue(m.getMeasuredValue())
                                .status(m.getStatus().name())
                                .measurementNote(m.getMeasurementNote())
                                .postAction(m.getPostAction())
                                .isPending(m.getIsPending())
                                .pendingReason(m.getPendingReason())
                                .build())
                        .toList();

                kpiHealths.add(KpiHealthReportResponse.KpiHealthDto.builder()
                        .kpiId(kpi.getId())
                        .kpiName(kpi.getName())
                        .sourceSystem(kpi.getSourceSystem())
                        .targetExpression(kpi.getTargetExpression())
                        .direction(kpi.getDirection().name())
                        .unit(kpi.getUnit())
                        .assigneeCount(assignments.size())
                        .overallScore(overallScore)
                        .overallStatus(status.name())
                        .measurements(measurementDtos)
                        .build());
            }

            kraHealths.add(KpiHealthReportResponse.KraHealthDto.builder()
                    .kraAreaId(kra.getId())
                    .kraAreaName(kra.getAreaName())
                    .kpiHealths(kpiHealths)
                    .build());
        }

        return KpiHealthReportResponse.builder()
                .kraHealths(kraHealths)
                .build();
    }

    /**
     * Helper to compute overall score for a KPI based on the user's specific requirement:
     * - Compute overall score by taking the average of assignee-level averages for that KPI.
     */
    private BigDecimal calculateAssigneeBasedOverallKpiScore(KpiMetric kpi, List<KpiEmployeeAssignment> assignments, List<KpiMeasurement> measurements) {
        if (assignments.isEmpty()) {
            // Fallback: If no explicit assignments exist in system but measurements are logged, 
            // average the measurements directly so we don't return null erroneously
            List<KpiMeasurement> validMeasurements = measurements.stream()
                    .filter(m -> !m.getIsPending() && !m.getIsCorrected() && m.getMeasuredValue() != null)
                    .toList();

            if (validMeasurements.isEmpty()) return null;
            BigDecimal sum = BigDecimal.ZERO;
            for (KpiMeasurement m : validMeasurements) {
                sum = sum.add(m.getMeasuredValue());
            }
            return sum.divide(BigDecimal.valueOf(validMeasurements.size()), 4, RoundingMode.HALF_UP);
        }

        List<BigDecimal> assigneeAverages = new ArrayList<>();

        for (KpiEmployeeAssignment assignment : assignments) {
            Employee assignee = assignment.getEmployee();

            // Find all valid logged measurements for this specific assignee in this period
            List<KpiMeasurement> assigneeLogs = measurements.stream()
                    .filter(m -> m.getMeasuredBy().getId().equals(assignee.getId()) 
                            && !m.getIsPending() 
                            && !m.getIsCorrected()
                            && m.getMeasuredValue() != null)
                    .toList();

            if (!assigneeLogs.isEmpty()) {
                BigDecimal sum = BigDecimal.ZERO;
                for (KpiMeasurement log : assigneeLogs) {
                    sum = sum.add(log.getMeasuredValue());
                }
                BigDecimal average = sum.divide(BigDecimal.valueOf(assigneeLogs.size()), 4, RoundingMode.HALF_UP);
                assigneeAverages.add(average);
            }
        }

        // If no assignee has logged any measurements yet, overall score is null
        if (assigneeAverages.isEmpty()) {
            return null;
        }

        // Compute average of assignee averages
        BigDecimal sumOfAverages = BigDecimal.ZERO;
        for (BigDecimal avg : assigneeAverages) {
            sumOfAverages = sumOfAverages.add(avg);
        }
        return sumOfAverages.divide(BigDecimal.valueOf(assigneeAverages.size()), 4, RoundingMode.HALF_UP);
    }

    /**
     * Helper to compute the RAG status of a score based on threshold limits configured for a KPI.
     */
    private MeasurementStatus computeStatus(BigDecimal value, Direction direction, BigDecimal target, BigDecimal warn, BigDecimal critical) {
        if (value == null || target == null) {
            return MeasurementStatus.unknown;
        }

        // Handle binary green/red state if thresholds are null
        if (warn == null && critical == null) {
            if (direction == Direction.higher_better) {
                return value.compareTo(target) >= 0 ? MeasurementStatus.green : MeasurementStatus.red;
            } else if (direction == Direction.lower_better) {
                return value.compareTo(target) <= 0 ? MeasurementStatus.green : MeasurementStatus.red;
            } else if (direction == Direction.target) {
                return value.compareTo(target) == 0 ? MeasurementStatus.green : MeasurementStatus.red;
            }
            return MeasurementStatus.unknown;
        }

        if (direction == Direction.higher_better) {
            // higher_better:
            // - Green: value >= target
            // - Amber: warn <= value < target
            // - Red: critical <= value < warn
            // - Critical: value < critical
            if (value.compareTo(target) >= 0) {
                return MeasurementStatus.green;
            }
            if (warn != null && value.compareTo(warn) >= 0) {
                return MeasurementStatus.amber;
            }
            if (critical != null && value.compareTo(critical) >= 0) {
                return MeasurementStatus.red;
            }
            return MeasurementStatus.critical;
        } else if (direction == Direction.lower_better) {
            // lower_better:
            // - Green: value <= target
            // - Amber: target < value <= warn
            // - Red: warn < value <= critical
            // - Critical: value > critical
            if (value.compareTo(target) <= 0) {
                return MeasurementStatus.green;
            }
            if (warn != null && value.compareTo(warn) <= 0) {
                return MeasurementStatus.amber;
            }
            if (critical != null && value.compareTo(critical) <= 0) {
                return MeasurementStatus.red;
            }
            return MeasurementStatus.critical;
        } else if (direction == Direction.target) {
            // target:
            // - Green: |value - target| = 0
            // - Amber: |value - target| <= 1
            // - Red: |value - target| <= 3
            // - Critical: |value - target| > 3
            BigDecimal diff = value.subtract(target).abs();
            if (diff.compareTo(BigDecimal.ZERO) == 0) {
                return MeasurementStatus.green;
            }
            if (diff.compareTo(BigDecimal.ONE) <= 0) {
                return MeasurementStatus.amber;
            }
            if (diff.compareTo(BigDecimal.valueOf(3)) <= 0) {
                return MeasurementStatus.red;
            }
            return MeasurementStatus.critical;
        }

        return MeasurementStatus.unknown;
    }
}

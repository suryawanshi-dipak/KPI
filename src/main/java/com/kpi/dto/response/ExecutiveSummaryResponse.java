package com.kpi.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * DTO representing the Executive Summary Report response.
 * This class is designed to provide senior leadership with a high-level operational overview 
 * of the company's KPI health across all KRA (Key Result Area) domains.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ExecutiveSummaryResponse {

    /**
     * Map showing the distribution of KPI statuses across the organization.
     * Keys represent the MeasurementStatus values (e.g. "green", "amber", "red", "critical", "unknown").
     * Values represent the count of KPIs currently holding that status in this period.
     */
    private Map<String, Long> statusDistribution;

    /**
     * The total number of active KPI Metrics configured in the system.
     */
    private int totalKpis;

    /**
     * The number of active KPIs that have been successfully measured (where a value is logged
     * and status is not 'unknown' / pending).
     */
    private int measuredKpis;

    /**
     * Detailed summaries for each KRA Area, including computed scores and assignee counts.
     */
    private List<KraSummaryDto> kraSummaries;

    /**
     * List of pending measurements that have not yet been recorded for this period.
     * Identifies exactly which assignee is responsible and why the data is delayed.
     */
    private List<PendingMeasurementDto> pendingMeasurements;

    /**
     * Watchlist of critical items showing measurements that are in a 'red' or 'critical' status.
     * Allows immediate escalation of failing metrics.
     */
    private List<CriticalWatchlistDto> criticalWatchlist;

    /**
     * Sub-DTO representing a summary of a KRA (Key Result Area).
     */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class KraSummaryDto {
        
        /**
         * The ID of the KRA Area.
         */
        private Integer kraAreaId;

        /**
         * The name of the KRA Area (e.g. "Quality Engineering & Reliability").
         */
        private String kraAreaName;

        /**
         * The total number of KPI Metrics linked under this KRA Area.
         */
        private int totalKpis;

        /**
         * The total number of assignments across all KPIs in this KRA area.
         * Calculated by summing up the assignee count of each KPI belonging to this KRA.
         */
        private int totalAssignees;

        /**
         * The overall score calculated for this KRA Area.
         * Computed as the mathematical average of the overall scores of all KPIs in this KRA.
         */
        private BigDecimal overallScore;
    }

    /**
     * Sub-DTO representing a pending measurement entry for this period.
     */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class PendingMeasurementDto {

        /**
         * The name of the KPI Metric that is pending.
         */
        private String kpiName;

        /**
         * The name of the Employee assigned to log this KPI measurement.
         */
        private String assigneeName;

        /**
         * The reason why the measurement is pending.
         * Can be a reason recorded in the database or "No measurement recorded yet" if missing.
         */
        private String reason;
    }

    /**
     * Sub-DTO representing a critical or red measurement in this period.
     */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CriticalWatchlistDto {

        /**
         * The name of the KPI Metric.
         */
        private String kpiName;

        /**
         * The name of the Employee responsible for logging this measurement.
         */
        private String assigneeName;

        /**
         * The actual measured value recorded.
         */
        private BigDecimal measuredValue;

        /**
         * The target value specified by the KPI Metric configuration.
         */
        private BigDecimal targetValue;

        /**
         * The planned mitigation or post-action recorded by the assignee.
         */
        private String postAction;

        /**
         * The status of the measurement (typically "red" or "critical").
         */
        private String status;
    }
}

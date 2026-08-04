package com.kpi.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

import java.math.BigDecimal;
import java.util.List;

/**
 * DTO representing the KPI Health Report response.
 * This report provides a detailed operational view, grouping KPIs under their KRA areas,
 * showing the assignee counts, overall computed scores, overall computed statuses,
 * and individual measurement logs for auditing.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class KpiHealthReportResponse {

    /**
     * List of KRA Areas along with their nested KPI health details.
     */
    private List<KraHealthDto> kraHealths;

    /**
     * Sub-DTO representing the health of a specific KRA Area.
     */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class KraHealthDto {
        
        /**
         * The ID of the KRA Area.
         */
        private Integer kraAreaId;

        /**
         * The name of the KRA Area.
         */
        private String kraAreaName;

        /**
         * The list of KPIs linked to this KRA Area and their current health metrics.
         */
        private List<KpiHealthDto> kpiHealths;
    }

    /**
     * Sub-DTO representing the health of a specific KPI Metric.
     */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class KpiHealthDto {

        /**
         * The ID of the KPI Metric.
         */
        private Integer kpiId;

        /**
         * The name of the KPI Metric.
         */
        private String kpiName;

        /**
         * The source system (e.g. "Jira", "Zendesk") where this KPI is tracked.
         */
        private String sourceSystem;

        /**
         * The target expression for this KPI (e.g., "< 3 per quarter").
         */
        private String targetExpression;

        /**
         * The direction of the KPI (higher_better, lower_better, target).
         */
        private String direction;

        /**
         * The unit of measurement (e.g., "Count", "Percentage").
         */
        private String unit;

        /**
         * The total number of active employees assigned to this KPI.
         */
        private int assigneeCount;

        /**
         * The overall score calculated for this KPI.
         * Computed as the average of the assignee-level average measurement values.
         */
        private BigDecimal overallScore;

        /**
         * The overall status calculated for this KPI based on its overall score and thresholds.
         * Possible values: "green", "amber", "red", "critical", "unknown".
         */
        private String overallStatus;

        /**
         * Individual measurement logs submitted by assignees for this KPI in the period.
         */
        private List<KpiHealthMeasurementDto> measurements;
    }

    /**
     * Sub-DTO representing an individual assignee's measurement log for auditing.
     */
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class KpiHealthMeasurementDto {

        /**
         * The name of the Employee who logged this measurement.
         */
        private String assigneeName;

        /**
         * The value recorded by this assignee.
         */
        private BigDecimal measuredValue;

        /**
         * The computed status of this specific measurement.
         */
        private String status;

        /**
         * Explanation or commentary recorded by the assignee.
         */
        private String measurementNote;

        /**
         * Planned mitigation or post-action recorded by the assignee.
         */
        private String postAction;

        /**
         * Indicates if this entry was flagged as pending.
         */
        private Boolean isPending;

        /**
         * The reason why this measurement is pending.
         */
        private String pendingReason;
    }
}

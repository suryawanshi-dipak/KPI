package com.kpi.dto.response;

import com.kpi.entity.enums.Frequency;
import com.kpi.entity.enums.MeasurementStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KpiMeasurementResponse {

    private Long id;

    private Integer kpiMetricId;
    private String kpiMetricName;

    private Integer kraAreaId;
    private String kraAreaName;

    private Integer kpiMetricVersion;

    private BigDecimal measuredValue;

    private Frequency measurementPeriodType;
    private String measurementPeriodLabel;

    private LocalDate periodStartDate;
    private LocalDate periodEndDate;

    private MeasurementStatus status;

    private String measurementNote;
    private String rawPayload;
    private String postAction;

    private LocalDateTime measuredAt;

    private Integer measuredById;
    private String measuredByName;

    private Integer subjectEmployeeId;
    private String subjectEmployeeName;

    private Boolean isSystemGenerated;
    private Boolean isPending;
    private String pendingReason;
    private Boolean isCorrected;
    private Long correctedFromId;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Integer createdBy;
    private Integer updatedBy;

    // FR-PW-12: proactive work entries linked to this measurement, embedded so the KPI-detail
    // widget costs zero additional round trips. Populated only by getByMetricId — see
    // KpiMeasurementServiceImpl.
    private List<ProactiveWorkEntrySummaryResponse> proactiveWorkEntries;
}

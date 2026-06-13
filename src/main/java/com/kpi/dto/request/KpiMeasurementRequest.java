package com.kpi.dto.request;

import com.kpi.entity.enums.Frequency;
import com.kpi.entity.enums.MeasurementStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KpiMeasurementRequest {

    @NotNull(message = "KPI Metric is required")
    private Integer kpiMetricId;

    private BigDecimal measuredValue;

    @NotNull(message = "Measurement period type is required")
    private Frequency measurementPeriodType;

    @NotBlank(message = "Measurement period label is required")
    @Size(max = 50, message = "Period label must not exceed 50 characters")
    private String measurementPeriodLabel;

    @NotNull(message = "Period start date is required")
    private LocalDate periodStartDate;

    @NotNull(message = "Period end date is required")
    private LocalDate periodEndDate;

    @NotNull(message = "Status is required")
    private MeasurementStatus status;

    private String measurementNote;

    private String rawPayload;

    private String postAction;

    @NotNull(message = "Measured by employee is required")
    private Integer measuredById;

    private Boolean isSystemGenerated;

    private Boolean isPending;

    private String pendingReason;

    // When submitting a correction, reference the original measurement
    private Long correctedFromId;
}

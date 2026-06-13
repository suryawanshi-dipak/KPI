package com.kpi.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KpiAssignmentRequest {

    @NotNull(message = "KPI Metric is required")
    private Integer kpiMetricId;

    @NotNull(message = "Employee is required")
    private Integer employeeId;

    private String team;

    private Boolean isPrimary;

    private LocalDate assignedFrom;

    private LocalDate assignedTo;
}

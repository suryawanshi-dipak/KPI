package com.kpi.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KpiAssignmentResponse {

    private Integer id;

    private Integer kpiMetricId;
    private String kpiMetricName;

    private Integer kraAreaId;
    private String kraAreaName;

    private Integer employeeId;
    private String employeeName;

    private String team;

    private Boolean isPrimary;

    private LocalDate assignedFrom;
    private LocalDate assignedTo;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Integer createdBy;
    private Integer updatedBy;
}

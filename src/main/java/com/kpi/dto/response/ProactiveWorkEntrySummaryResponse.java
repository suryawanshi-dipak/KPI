package com.kpi.dto.response;

import com.kpi.entity.enums.ProactiveWorkCategory;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/** Lightweight shape embedded in KpiMeasurementResponse for the KPI-detail widget (FR-PW-12). */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProactiveWorkEntrySummaryResponse {

    private Long id;
    private String title;
    private String description;
    private ProactiveWorkCategory category;
    private String subjectEmployeeName;
    private String loggedByName;
    private LocalDate effortStartDate;
    private LocalDate effortEndDate;
    private Boolean isHighlighted;
}

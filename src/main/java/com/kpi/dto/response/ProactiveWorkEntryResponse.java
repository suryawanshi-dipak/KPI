package com.kpi.dto.response;

import com.kpi.entity.enums.ProactiveWorkCategory;
import com.kpi.entity.enums.ProactiveWorkEntryType;
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
public class ProactiveWorkEntryResponse {

    private Long id;

    private Long kpiMeasurementId;
    private String kpiMetricName;
    private String kpiMeasurementPeriodLabel;

    private ProactiveWorkEntryType entryType;
    private ProactiveWorkCategory category;
    private String otherCategoryText;

    private Integer subjectEmployeeId;
    private String subjectEmployeeName;
    private Integer loggedById;
    private String loggedByName;

    private String title;
    private String description;

    private LocalDate effortStartDate;
    private LocalDate effortEndDate;

    private Boolean isSeen;
    private LocalDateTime seenAt;
    private Integer seenById;

    private Boolean isHighlighted;
    private LocalDateTime highlightedAt;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

package com.kpi.dto.response;

import com.kpi.entity.enums.ProactiveWorkCategory;
import com.kpi.entity.enums.ProactiveWorkEntryType;
import com.kpi.entity.enums.ProactiveWorkKind;
import com.kpi.entity.enums.ProactiveWorkVisibility;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProactiveWorkEntryResponse {

    private Long id;

    // Null (all three) when the viewer isn't permitted to see the linked measurement — not just
    // the name withheld, so the response carries no trace that a link exists at all.
    private Long kpiMeasurementId;
    private String kpiMetricName;
    private String kpiMeasurementPeriodLabel;

    private ProactiveWorkEntryType entryType;
    private ProactiveWorkKind workKind;
    private ProactiveWorkCategory category;
    private String otherCategoryText;

    // subjectEmployeeId stays as the legacy single "primary" subject (the logger, for entries
    // created after v4 — see ProactiveWorkServiceImpl#create). subjectEmployeeIds is the full
    // credited set, and subjectEmployeeName is now the " & "-joined display name for all of
    // them, so every existing screen that renders subjectEmployeeName keeps working unchanged.
    private Integer subjectEmployeeId;
    private List<Integer> subjectEmployeeIds;
    private String subjectEmployeeName;
    private Integer loggedById;
    private String loggedByName;

    private String title;
    private String description;
    private String valueStatement;

    private LocalDate effortStartDate;
    private LocalDate effortEndDate;

    private ProactiveWorkVisibility visibility;

    private Boolean isSeen;
    private LocalDateTime seenAt;
    private Integer seenById;
    private String seenByName;

    private Boolean isHighlighted;
    private LocalDateTime highlightedAt;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime editedAt;

    private Integer endorsementCount;
    private Integer commentCount;
    private Boolean endorsedByMe;

    // Populated only on the single-entry detail fetch, left null on list responses — a 25-row
    // list doesn't need every row's full endorser roster and comment thread inlined.
    private List<ProactiveWorkEndorserResponse> endorsers;
    private List<ProactiveWorkCommentResponse> comments;
}

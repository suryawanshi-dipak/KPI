package com.kpi.dto.response;

import com.kpi.entity.KpiFeedbackAction.JiraResolutionCategory;
import com.kpi.entity.KpiFeedbackAction.VerificationResult;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** Response model returned by all KPI feedback-action endpoints. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KpiFeedbackActionResponse {

    private Long id;
    private Long kpiMeasurementId;
    private String rootCauseSummary;
    private String linkedJiraIssueKey;
    private Integer submittedBy;
    private String submittedByName;
    private LocalDateTime submittedAt;
    private String jiraStatusSnapshot;
    private LocalDateTime jiraStatusLastSyncedAt;
    private LocalDateTime jiraResolvedAt;
    private JiraResolutionCategory jiraResolutionCategory;
    private VerificationResult verificationResult;
    private Long verificationKpiMeasurementId;
    private LocalDateTime verificationCheckedAt;
    private Long relatedPreviousFeedbackId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Integer createdBy;
    private Integer updatedBy;
}

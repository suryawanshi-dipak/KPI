package com.kpi.dto.request;

import com.kpi.entity.KpiFeedbackAction.JiraResolutionCategory;
import com.kpi.entity.KpiFeedbackAction.VerificationResult;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Request payload used to create or fully edit a KPI feedback/remediation action.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KpiFeedbackActionRequest {

    /** The KPI measurement that triggered the feedback action. */
    @NotNull(message = "KPI measurement is required")
    private Long kpiMeasurementId;

    /** Concise explanation of the cause that the remediation addresses. */
    @NotBlank(message = "Root cause summary is required")
    @Size(max = 65535, message = "Root cause summary is too long")
    private String rootCauseSummary;

    /** Optional Jira issue used to track the engineering remediation. */
    @Size(max = 20, message = "Jira issue key must not exceed 20 characters")
    private String linkedJiraIssueKey;

    /** Employee ID of the person submitting the feedback action. */
    @NotNull(message = "Submitted by employee is required")
    private Integer submittedBy;

    /** Optional business submission time; defaults to the current time when omitted. */
    private LocalDateTime submittedAt;

    /** Latest Jira status known by the KPI application. */
    @Size(max = 50, message = "Jira status must not exceed 50 characters")
    private String jiraStatusSnapshot;

    /** Time at which the Jira status was last synchronized. */
    private LocalDateTime jiraStatusLastSyncedAt;

    /** Jira resolution timestamp, when the linked issue has been resolved. */
    private LocalDateTime jiraResolvedAt;

    /** Whether Jira reports that the root cause was fixed or not fixed. */
    private JiraResolutionCategory jiraResolutionCategory;

    /** Outcome of checking the KPI after remediation. */
    private VerificationResult verificationResult;

    /** Measurement used as evidence for the verification outcome. */
    private Long verificationKpiMeasurementId;

    /** Time at which the KPI verification was completed. */
    private LocalDateTime verificationCheckedAt;

    /** Optional earlier feedback action that this action follows up. */
    private Long relatedPreviousFeedbackId;
}

package com.kpi.dto.request;

import com.kpi.entity.KpiFeedbackAction.JiraResolutionCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** Request payload for updating only the Jira synchronization information. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JiraStatusUpdateRequest {

    /** Status returned from Jira, for example "In Progress" or "Done". */
    @NotBlank(message = "Jira status is required")
    @Size(max = 50, message = "Jira status must not exceed 50 characters")
    private String jiraStatusSnapshot;

    /** Explicit synchronization time; defaults to now when omitted. */
    private LocalDateTime jiraStatusLastSyncedAt;

    /** Resolution time reported by Jira when the work is complete. */
    private LocalDateTime jiraResolvedAt;

    /** Final Jira remediation category, if Jira has reached a conclusion. */
    private JiraResolutionCategory jiraResolutionCategory;
}

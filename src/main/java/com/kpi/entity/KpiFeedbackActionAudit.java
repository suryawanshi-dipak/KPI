package com.kpi.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "kpi_feedback_action_audit")
public class KpiFeedbackActionAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "kpi_feedback_action_id", nullable = false)
    private Long kpiFeedbackActionId;

    @Column(name = "root_cause_summary", columnDefinition = "TEXT")
    private String rootCauseSummary;

    @Column(name = "linked_jira_issue_key", length = 20)
    private String linkedJiraIssueKey;

    @Column(name = "action_type", nullable = false, length = 20)
    private String actionType;

    @Column(name = "changed_by")
    private Integer changedBy;

    @Column(name = "changed_at", nullable = false)
    private LocalDateTime changedAt = LocalDateTime.now();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getKpiFeedbackActionId() {
        return kpiFeedbackActionId;
    }

    public void setKpiFeedbackActionId(Long kpiFeedbackActionId) {
        this.kpiFeedbackActionId = kpiFeedbackActionId;
    }

    public String getRootCauseSummary() {
        return rootCauseSummary;
    }

    public void setRootCauseSummary(String rootCauseSummary) {
        this.rootCauseSummary = rootCauseSummary;
    }

    public String getLinkedJiraIssueKey() {
        return linkedJiraIssueKey;
    }

    public void setLinkedJiraIssueKey(String linkedJiraIssueKey) {
        this.linkedJiraIssueKey = linkedJiraIssueKey;
    }

    public String getActionType() {
        return actionType;
    }

    public void setActionType(String actionType) {
        this.actionType = actionType;
    }

    public Integer getChangedBy() {
        return changedBy;
    }

    public void setChangedBy(Integer changedBy) {
        this.changedBy = changedBy;
    }

    public LocalDateTime getChangedAt() {
        return changedAt;
    }

    public void setChangedAt(LocalDateTime changedAt) {
        this.changedAt = changedAt;
    }
}

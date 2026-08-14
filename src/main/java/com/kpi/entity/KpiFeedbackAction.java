package com.kpi.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "kpi_feedback_action")
public class KpiFeedbackAction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "kpi_measurement_id", nullable = false)
    private Long kpiMeasurementId;

    @Column(name = "root_cause_summary", nullable = false, columnDefinition = "TEXT")
    private String rootCauseSummary;

    @Column(name = "linked_jira_issue_key", length = 20)
    private String linkedJiraIssueKey;

    @Column(name = "submitted_by", nullable = false)
    private Integer submittedBy;

    @Column(name = "submitted_at", nullable = false)
    private LocalDateTime submittedAt = LocalDateTime.now();

    @Column(name = "jira_status_snapshot", length = 50)
    private String jiraStatusSnapshot;

    @Column(name = "jira_status_last_synced_at")
    private LocalDateTime jiraStatusLastSyncedAt;

    @Column(name = "jira_resolved_at")
    private LocalDateTime jiraResolvedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "jira_resolution_category")
    private JiraResolutionCategory jiraResolutionCategory; // fixed, not_fixed

    @Enumerated(EnumType.STRING)
    @Column(name = "verification_result")
    private VerificationResult verificationResult; // pending, improved, not_improved, not_verifiable

    @Column(name = "verification_kpi_measurement_id")
    private Long verificationKpiMeasurementId;

    @Column(name = "verification_checked_at")
    private LocalDateTime verificationCheckedAt;

    @Column(name = "related_previous_feedback_id")
    private Long relatedPreviousFeedbackId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "created_by")
    private Integer createdBy;

    @Column(name = "updated_by")
    private Integer updatedBy;

    @Column(name = "is_deleted", nullable = false)
    private Boolean isDeleted = false;

    public enum JiraResolutionCategory {
        fixed,
        not_fixed
    }

    public enum VerificationResult {
        pending,
        improved,
        not_improved,
        not_verifiable
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getKpiMeasurementId() {
        return kpiMeasurementId;
    }

    public void setKpiMeasurementId(Long kpiMeasurementId) {
        this.kpiMeasurementId = kpiMeasurementId;
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

    public Integer getSubmittedBy() {
        return submittedBy;
    }

    public void setSubmittedBy(Integer submittedBy) {
        this.submittedBy = submittedBy;
    }

    public LocalDateTime getSubmittedAt() {
        return submittedAt;
    }

    public void setSubmittedAt(LocalDateTime submittedAt) {
        this.submittedAt = submittedAt;
    }

    public String getJiraStatusSnapshot() {
        return jiraStatusSnapshot;
    }

    public void setJiraStatusSnapshot(String jiraStatusSnapshot) {
        this.jiraStatusSnapshot = jiraStatusSnapshot;
    }

    public LocalDateTime getJiraStatusLastSyncedAt() {
        return jiraStatusLastSyncedAt;
    }

    public void setJiraStatusLastSyncedAt(LocalDateTime jiraStatusLastSyncedAt) {
        this.jiraStatusLastSyncedAt = jiraStatusLastSyncedAt;
    }

    public LocalDateTime getJiraResolvedAt() {
        return jiraResolvedAt;
    }

    public void setJiraResolvedAt(LocalDateTime jiraResolvedAt) {
        this.jiraResolvedAt = jiraResolvedAt;
    }

    public JiraResolutionCategory getJiraResolutionCategory() {
        return jiraResolutionCategory;
    }

    public void setJiraResolutionCategory(JiraResolutionCategory jiraResolutionCategory) {
        this.jiraResolutionCategory = jiraResolutionCategory;
    }

    public VerificationResult getVerificationResult() {
        return verificationResult;
    }

    public void setVerificationResult(VerificationResult verificationResult) {
        this.verificationResult = verificationResult;
    }

    public Long getVerificationKpiMeasurementId() {
        return verificationKpiMeasurementId;
    }

    public void setVerificationKpiMeasurementId(Long verificationKpiMeasurementId) {
        this.verificationKpiMeasurementId = verificationKpiMeasurementId;
    }

    public LocalDateTime getVerificationCheckedAt() {
        return verificationCheckedAt;
    }

    public void setVerificationCheckedAt(LocalDateTime verificationCheckedAt) {
        this.verificationCheckedAt = verificationCheckedAt;
    }

    public Long getRelatedPreviousFeedbackId() {
        return relatedPreviousFeedbackId;
    }

    public void setRelatedPreviousFeedbackId(Long relatedPreviousFeedbackId) {
        this.relatedPreviousFeedbackId = relatedPreviousFeedbackId;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Integer getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(Integer createdBy) {
        this.createdBy = createdBy;
    }

    public Integer getUpdatedBy() {
        return updatedBy;
    }

    public void setUpdatedBy(Integer updatedBy) {
        this.updatedBy = updatedBy;
    }

    public Boolean getIsDeleted() {
        return isDeleted;
    }

    public void setIsDeleted(Boolean isDeleted) {
        this.isDeleted = isDeleted;
    }
}


package com.kpi.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;

@Entity
@Table(name = "kpi_feedback_action_audit")
public class KpiFeedbackActionAudit {

    public enum ChangeType {
        CREATE,
        UPDATE,
        VERIFICATION,
        ADMIN_CORRECTION
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "feedback_action_id", nullable = false)
    private Long feedbackActionId;

    @Column(name = "changed_by", nullable = false)
    private Integer changedBy;

    @Column(name = "changed_at", nullable = false)
    private LocalDateTime changedAt = LocalDateTime.now();

    @Enumerated(EnumType.STRING)
    @Column(name = "change_type", nullable = false)
    private ChangeType changeType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "old_values", columnDefinition = "json")
    private Map<String, Object> oldValues;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "new_values", columnDefinition = "json")
    private Map<String, Object> newValues;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getFeedbackActionId() {
        return feedbackActionId;
    }

    public void setFeedbackActionId(Long feedbackActionId) {
        this.feedbackActionId = feedbackActionId;
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

    public ChangeType getChangeType() {
        return changeType;
    }

    public void setChangeType(ChangeType changeType) {
        this.changeType = changeType;
    }

    public Map<String, Object> getOldValues() {
        return oldValues;
    }

    public void setOldValues(Map<String, Object> oldValues) {
        this.oldValues = oldValues;
    }

    public Map<String, Object> getNewValues() {
        return newValues;
    }

    public void setNewValues(Map<String, Object> newValues) {
        this.newValues = newValues;
    }
}

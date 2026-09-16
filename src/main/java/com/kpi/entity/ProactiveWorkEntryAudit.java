package com.kpi.entity;

import com.kpi.entity.enums.ProactiveWorkAuditActionType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;

@Entity
@Table(name = "proactive_work_entry_audit")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProactiveWorkEntryAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "entry_id", nullable = false)
    private Long entryId;

    @Enumerated(EnumType.STRING)
    @Column(name = "action_type", nullable = false)
    private ProactiveWorkAuditActionType actionType;

    @Column(name = "actor_id", nullable = false)
    private Integer actorId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "changed_fields", columnDefinition = "json")
    private Map<String, Object> changedFields;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}

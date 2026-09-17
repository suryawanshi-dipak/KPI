package com.kpi.entity;

import com.kpi.entity.enums.DeliveryFrequency;
import com.kpi.entity.enums.NewEntryScope;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.time.LocalTime;

/** One row per employee, created lazily on first read/write. A missing row means all defaults
 *  apply — {@link com.kpi.service.NotificationService} must never assume this row exists. */
@Entity
@Table(name = "notification_preference")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NotificationPreference {

    @Id
    @Column(name = "employee_id")
    private Integer employeeId;

    @Enumerated(EnumType.STRING)
    @Column(name = "new_entry_scope", nullable = false)
    @Builder.Default
    private NewEntryScope newEntryScope = NewEntryScope.EVERYONE;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private DeliveryFrequency delivery = DeliveryFrequency.INSTANT;

    @Column(name = "own_activity", nullable = false)
    @Builder.Default
    private Boolean ownActivity = true;

    @Column(nullable = false)
    @Builder.Default
    private Boolean highlight = true;

    @Column(name = "quiet_from")
    private LocalTime quietFrom;

    @Column(name = "quiet_to")
    private LocalTime quietTo;

    /** Set the first time this employee is ever offered the browser permission prompt, win or
     *  lose — the frontend uses this to guarantee it never asks a second time. */
    @Column(name = "permission_asked_at")
    private LocalDateTime permissionAskedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}

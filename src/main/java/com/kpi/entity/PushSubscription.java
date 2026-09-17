package com.kpi.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/** One row per browser per person. The browser reissues the same endpoint on re-subscribe,
 *  so the service layer upserts on {@code endpoint} rather than always inserting. */
@Entity
@Table(name = "push_subscription")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PushSubscription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "employee_id", nullable = false)
    private Integer employeeId;

    @Column(nullable = false, length = 500)
    private String endpoint;

    @Column(nullable = false)
    private String p256dh;

    @Column(nullable = false)
    private String auth;

    @Column(name = "user_agent")
    private String userAgent;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "last_success_at")
    private LocalDateTime lastSuccessAt;

    /** Non-null means the browser told us (404/410) this endpoint is gone. Never retried. */
    @Column(name = "revoked_at")
    private LocalDateTime revokedAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}

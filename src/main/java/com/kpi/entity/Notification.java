package com.kpi.entity;

import com.kpi.entity.enums.NotificationType;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/** Written for every recipient whether or not a push succeeds — this table is the bell feed's
 *  source of truth; push is an enhancement layered on top, never the only place this appears. */
@Entity
@Table(name = "notification")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "recipient_id", nullable = false)
    private Integer recipientId;

    /** Who did the thing this notification is about — the logger for NEW_ENTRY/LOGGED_FOR_YOU,
     *  or the endorser/commenter/highlighter for the activity types. Nullable so old rows and
     *  system-generated ones degrade gracefully rather than needing a backfill. */
    @Column(name = "actor_id")
    private Integer actorId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private NotificationType type;

    @Column(name = "entry_id", nullable = false)
    private Long entryId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "read_at")
    private LocalDateTime readAt;

    /** Null until a push actually succeeds for this recipient — read by both digest jobs to
     *  find pending work, and left null forever if the recipient has no active subscription. */
    @Column(name = "pushed_at")
    private LocalDateTime pushedAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}

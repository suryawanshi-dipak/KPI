package com.kpi.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * One row per person per entry, ever. Withdrawing sets withdrawnAt rather than deleting the
 * row, so the unique (entry_id, employee_id) key holds and re-endorsing reuses it.
 */
@Entity
@Table(name = "proactive_work_endorsement")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProactiveWorkEndorsement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "entry_id", nullable = false)
    private Long entryId;

    @Column(name = "employee_id", nullable = false)
    private Integer employeeId;

    // Copied from the entry at insert so no-self-endorsement can be a database CHECK rather
    // than a service-layer hope.
    @Column(name = "subject_employee_id", nullable = false)
    private Integer subjectEmployeeId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "withdrawn_at")
    private LocalDateTime withdrawnAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}

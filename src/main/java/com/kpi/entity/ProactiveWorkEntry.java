package com.kpi.entity;

import com.kpi.entity.enums.ProactiveWorkCategory;
import com.kpi.entity.enums.ProactiveWorkEntryType;
import com.kpi.entity.enums.ProactiveWorkKind;
import com.kpi.entity.enums.ProactiveWorkVisibility;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * subjectEmployeeId / loggedById / seenById are stored as raw employee IDs rather than
 * @ManyToOne relations, mirroring KpiFeedbackAction — referenced employees are validated
 * explicitly in the service layer instead of relying on JPA fetches.
 */
@Entity
@Table(name = "proactive_work_entry")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProactiveWorkEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "kpi_measurement_id")
    private Long kpiMeasurementId;

    // Stored generated column (GENERATED ALWAYS AS (kpi_measurement_id IS NULL ? STANDALONE :
    // KPI_LINKED) STORED). Never written by the application. Do not read this field for display
    // logic either — see ProactiveWorkServiceImpl#resolveEntryType, which derives it from
    // kpiMeasurementId instead, since Hibernate does not refresh generated columns after INSERT
    // without extra machinery this codebase doesn't otherwise use.
    @Enumerated(EnumType.STRING)
    @Column(name = "entry_type", nullable = false, insertable = false, updatable = false)
    private ProactiveWorkEntryType entryType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ProactiveWorkCategory category;

    // v3 — PROACTIVE (effort worth crediting) or MISSOUT (a self-reported shortfall). Additive
    // column, NOT NULL DEFAULT 'PROACTIVE' in the DB so every pre-existing row reads as PROACTIVE
    // without a backfill statement.
    @Enumerated(EnumType.STRING)
    @Column(name = "work_kind", nullable = false)
    @Builder.Default
    private ProactiveWorkKind workKind = ProactiveWorkKind.PROACTIVE;

    @Column(name = "other_category_text", length = 300)
    private String otherCategoryText;

    // v4 — the legacy "one subject" column. For entries created since joint credit shipped, this
    // is always the logger (loggedById) — see ProactiveWorkServiceImpl#create — kept as a stable
    // single value for the handful of places that still want exactly one id (e.g. an avatar's
    // colour hash), while subjectEmployeeIds below is the actual, possibly-multi-person, set of
    // credited people.
    @Column(name = "subject_employee_id", nullable = false)
    private Integer subjectEmployeeId;

    // v4 — every credited person, in the order they were added (mentioned people first, then
    // the logger last — see ProactiveWorkForm.jsx). A plain value-type collection table, not a
    // relation to Employee, mirroring how subjectEmployeeId/loggedById are already raw ids
    // rather than @ManyToOne — referenced employees are validated in the service layer.
    @ElementCollection
    @CollectionTable(name = "proactive_work_entry_subject", joinColumns = @JoinColumn(name = "entry_id"))
    @OrderColumn(name = "sort_order")
    @Column(name = "employee_id", nullable = false)
    @Builder.Default
    private List<Integer> subjectEmployeeIds = new ArrayList<>();

    @Column(name = "logged_by_id", nullable = false)
    private Integer loggedById;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    // v2 — "What did it change?" Free text, optional: requiring it invites an invented benefit.
    @Column(name = "value_statement", length = 200)
    private String valueStatement;

    @Column(name = "effort_start_date", nullable = false)
    private LocalDate effortStartDate;

    @Column(name = "effort_end_date", nullable = false)
    private LocalDate effortEndDate;

    // v2 — default ORGANISATION (visible to everyone); PRIVATE restores v1's own-entries scope
    // and suppresses endorse/comment entirely.
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private ProactiveWorkVisibility visibility = ProactiveWorkVisibility.ORGANISATION;

    @Column(name = "is_seen", nullable = false)
    @Builder.Default
    private Boolean isSeen = false;

    @Column(name = "seen_at")
    private LocalDateTime seenAt;

    @Column(name = "seen_by_id")
    private Integer seenById;

    @Column(name = "is_highlighted", nullable = false)
    @Builder.Default
    private Boolean isHighlighted = false;

    @Column(name = "highlighted_at")
    private LocalDateTime highlightedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    // v2 — null until the first content edit; drives the "Edited 12 Sep" line. updated_at also
    // moves on seen/highlight, so it can't do this job.
    @Column(name = "edited_at")
    private LocalDateTime editedAt;

    // v2 — denormalised so the list/summary render counts without a subquery per row.
    // Recalculated on every endorse/withdraw or comment create/delete, same transaction.
    @Column(name = "endorsement_count", nullable = false)
    @Builder.Default
    private Integer endorsementCount = 0;

    @Column(name = "comment_count", nullable = false)
    @Builder.Default
    private Integer commentCount = 0;

    @Column(name = "is_deleted", nullable = false)
    @Builder.Default
    private Boolean isDeleted = false;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
        if (isSeen == null) isSeen = false;
        if (isHighlighted == null) isHighlighted = false;
        if (isDeleted == null) isDeleted = false;
        if (visibility == null) visibility = ProactiveWorkVisibility.ORGANISATION;
        if (workKind == null) workKind = ProactiveWorkKind.PROACTIVE;
        if (endorsementCount == null) endorsementCount = 0;
        if (commentCount == null) commentCount = 0;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}

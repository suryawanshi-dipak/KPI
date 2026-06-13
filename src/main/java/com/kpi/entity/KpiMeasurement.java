package com.kpi.entity;

import com.kpi.entity.enums.Frequency;
import com.kpi.entity.enums.MeasurementStatus;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "kpi_measurement")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KpiMeasurement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kpi_metric_id", nullable = false)
    private KpiMetric kpiMetric;

    @Column(name = "kpi_metric_version")
    private Integer kpiMetricVersion;

    @Column(name = "measured_value", precision = 12, scale = 4)
    private BigDecimal measuredValue;

    @Enumerated(EnumType.STRING)
    @Column(name = "measurement_period_type", nullable = false)
    private Frequency measurementPeriodType;

    @Column(name = "measurement_period_label", nullable = false, length = 50)
    private String measurementPeriodLabel;

    @Column(name = "period_start_date", nullable = false)
    private LocalDate periodStartDate;

    @Column(name = "period_end_date", nullable = false)
    private LocalDate periodEndDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MeasurementStatus status;

    @Column(name = "measurement_note", columnDefinition = "TEXT")
    private String measurementNote;

    @Column(name = "raw_payload", columnDefinition = "MEDIUMTEXT")
    private String rawPayload;

    @Column(name = "post_action", columnDefinition = "TEXT")
    private String postAction;

    @Column(name = "measured_at", nullable = false, updatable = false)
    private LocalDateTime measuredAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "measured_by", nullable = false)
    private Employee measuredBy;

    @Column(name = "is_system_generated")
    @Builder.Default
    private Boolean isSystemGenerated = false;

    @Column(name = "is_pending")
    @Builder.Default
    private Boolean isPending = false;

    @Column(name = "pending_reason", columnDefinition = "TEXT")
    private String pendingReason;

    @Column(name = "is_corrected")
    @Builder.Default
    private Boolean isCorrected = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "corrected_from_id")
    private KpiMeasurement correctedFrom;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "is_deleted")
    @Builder.Default
    private Boolean isDeleted = false;

    @Column(name = "created_by")
    private Integer createdBy;

    @Column(name = "updated_by")
    private Integer updatedBy;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (measuredAt == null) measuredAt = LocalDateTime.now();
        if (isSystemGenerated == null) isSystemGenerated = false;
        if (isPending == null) isPending = false;
        if (isCorrected == null) isCorrected = false;
        if (isDeleted == null) isDeleted = false;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}

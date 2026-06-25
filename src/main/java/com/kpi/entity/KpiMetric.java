package com.kpi.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.kpi.converter.FrequencyConverter;
import com.kpi.entity.enums.Direction;
import com.kpi.entity.enums.Frequency;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "kpi_metric")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KpiMetric {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "kra_area_id", nullable = false)
    private KraArea kraArea;

    @Column(nullable = false, length = 300)
    private String name;

    @Column(name = "target_expression", length = 100)
    private String targetExpression;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Direction direction;

    @Column(name = "target_value", precision = 10, scale = 2)
    private BigDecimal targetValue;

    @Column(name = "warn_threshold", precision = 10, scale = 2)
    private BigDecimal warnThreshold;

    @Column(name = "critical_threshold", precision = 10, scale = 2)
    private BigDecimal criticalThreshold;

    @Column(length = 50)
    private String unit;

    @Convert(converter = FrequencyConverter.class)
    @Column(nullable = false)
    private Frequency frequency;

    @Column(name = "source_system", length = 200)
    private String sourceSystem;

    @Column(name = "source_reference", columnDefinition = "TEXT")
    private String sourceReference;

    @Column(name = "measurement_instruction", columnDefinition = "TEXT")
    private String measurementInstruction;

    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;

    @Builder.Default
    private Integer version = 1;

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

        if (isActive == null) {
            isActive = true;
        }

        if (isDeleted == null) {
            isDeleted = false;
        }

        if (version == null) {
            version = 1;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
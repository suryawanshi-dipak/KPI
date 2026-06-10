package com.kpi.dto.request;

import java.math.BigDecimal;

import com.kpi.entity.enums.Direction;
import com.kpi.entity.enums.Frequency;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder

public class KpiMetricRequest {

    private Integer kraAreaId;

    private String name;

    private String targetExpression;

    private Direction direction;

    private BigDecimal targetValue;

    private BigDecimal warnThreshold;

    private BigDecimal criticalThreshold;

    private String unit;

    private Frequency frequency;

    private String sourceSystem;

    private String sourceReference;

    private String measurementInstruction;

    private Boolean isActive;
}
package com.kpi.dto.request;

import java.math.BigDecimal;

import com.kpi.entity.enums.Direction;
import com.kpi.entity.enums.Frequency;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KpiMetricRequest {

    @NotNull(message = "KRA Area is required")
    private Integer kraAreaId;

    @NotBlank(message = "Name is required")
    @Size(max = 300, message = "Name must not exceed 300 characters")
    private String name;

    @Size(max = 100, message = "Target expression must not exceed 100 characters")
    private String targetExpression;

    @NotNull(message = "Direction is required")
    private Direction direction;

    private BigDecimal targetValue;

    private BigDecimal warnThreshold;

    private BigDecimal criticalThreshold;

    @Size(max = 50, message = "Unit must not exceed 50 characters")
    private String unit;

    @NotNull(message = "Frequency is required")
    private Frequency frequency;

    @Size(max = 200, message = "Source system must not exceed 200 characters")
    private String sourceSystem;

    private String sourceReference;

    private String measurementInstruction;

    private Boolean isActive;
}

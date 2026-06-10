package com.kpi.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;




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
public class KpiMetricResponse {
    
 private Integer id;

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

    private Integer version;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private Boolean isDeleted;

    private Integer createdBy;

    private Integer updatedBy;

}

package com.kpi.dto.request;

import com.kpi.entity.enums.ReviewStatus;
import com.kpi.entity.enums.ReviewType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PerformanceReviewRequest {

    @NotNull(message = "Employee is required")
    private Integer employeeId;

    private Integer reviewerId;

    private ReviewType reviewType;

    @Size(max = 50, message = "Period label must not exceed 50 characters")
    private String periodLabel;

    private LocalDate periodStart;

    private LocalDate periodEnd;

    private ReviewStatus status;

    // JSON string — structure: [{"kraAreaId": 1, "comments": "...", "score": 4.0}]
    private String kraComments;

    private BigDecimal overallScore;
}

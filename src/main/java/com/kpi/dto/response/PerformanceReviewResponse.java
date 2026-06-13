package com.kpi.dto.response;

import com.kpi.entity.enums.ReviewStatus;
import com.kpi.entity.enums.ReviewType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PerformanceReviewResponse {

    private Integer id;

    private Integer employeeId;
    private String employeeName;

    private Integer reviewerId;
    private String reviewerName;

    private ReviewType reviewType;
    private String periodLabel;
    private LocalDate periodStart;
    private LocalDate periodEnd;

    private ReviewStatus status;

    private String kraComments;

    private BigDecimal overallScore;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Integer createdBy;
    private Integer updatedBy;
}

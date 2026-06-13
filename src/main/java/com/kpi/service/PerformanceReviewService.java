package com.kpi.service;

import com.kpi.dto.request.PerformanceReviewRequest;
import com.kpi.dto.response.PerformanceReviewResponse;
import com.kpi.entity.enums.ReviewStatus;

import java.util.List;

public interface PerformanceReviewService {

    List<PerformanceReviewResponse> getAll();

    PerformanceReviewResponse getById(Integer id);

    List<PerformanceReviewResponse> getByEmployeeId(Integer employeeId);

    List<PerformanceReviewResponse> getByStatus(ReviewStatus status);

    PerformanceReviewResponse create(PerformanceReviewRequest request);

    PerformanceReviewResponse update(Integer id, PerformanceReviewRequest request);

    PerformanceReviewResponse submit(Integer id);

    PerformanceReviewResponse approve(Integer id);

    void delete(Integer id);
}

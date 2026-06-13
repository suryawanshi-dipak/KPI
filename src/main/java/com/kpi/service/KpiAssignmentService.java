package com.kpi.service;

import com.kpi.dto.request.KpiAssignmentRequest;
import com.kpi.dto.response.KpiAssignmentResponse;

import java.util.List;

public interface KpiAssignmentService {

    List<KpiAssignmentResponse> getAll();

    KpiAssignmentResponse getById(Integer id);

    List<KpiAssignmentResponse> getByMetricId(Integer metricId);

    List<KpiAssignmentResponse> getByEmployeeId(Integer employeeId);

    KpiAssignmentResponse create(KpiAssignmentRequest request);

    KpiAssignmentResponse update(Integer id, KpiAssignmentRequest request);

    void delete(Integer id);
}

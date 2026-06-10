package com.kpi.service;



import java.util.List;

import com.kpi.dto.request.KpiMetricRequest;
import com.kpi.dto.response.KpiMetricResponse;


public interface KpiMetricService {
    List<KpiMetricResponse> getAll(boolean activeOnly);

    KpiMetricResponse getById(Integer id);

    KpiMetricResponse create(KpiMetricRequest request);

    KpiMetricResponse update(Integer id, KpiMetricRequest request);

    void delete(Integer id);
}
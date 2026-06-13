package com.kpi.service;

import com.kpi.dto.request.KpiMeasurementRequest;
import com.kpi.dto.response.KpiMeasurementResponse;
import com.kpi.entity.enums.MeasurementStatus;

import java.util.List;

public interface KpiMeasurementService {

    List<KpiMeasurementResponse> getAll();

    KpiMeasurementResponse getById(Long id);

    List<KpiMeasurementResponse> getByMetricId(Integer metricId);

    List<KpiMeasurementResponse> getByStatus(MeasurementStatus status);

    List<KpiMeasurementResponse> getPending();

    KpiMeasurementResponse create(KpiMeasurementRequest request);

    KpiMeasurementResponse update(Long id, KpiMeasurementRequest request);

    void delete(Long id);
}

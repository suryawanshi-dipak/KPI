package com.kpi.service.impl;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.kpi.dto.request.KpiMetricRequest;
import com.kpi.dto.response.KpiMetricResponse;
import com.kpi.entity.KpiMetric;
import com.kpi.entity.KraArea;
import com.kpi.repository.KpiMetricRepository;
import com.kpi.repository.KraAreaRepository;
import com.kpi.service.KpiMetricService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class KpiMetricServiceImpl implements KpiMetricService {

    private final KpiMetricRepository kpiMetricRepository;
    private final KraAreaRepository kraAreaRepository;

    @Override
    public List<KpiMetricResponse> getAll(boolean activeOnly) {

        List<KpiMetric> metrics = activeOnly
                ? kpiMetricRepository.findByIsDeletedFalseAndIsActiveTrue()
                : kpiMetricRepository.findByIsDeletedFalse();

        return metrics.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    public KpiMetricResponse getById(Integer id) {

        KpiMetric metric = kpiMetricRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("KPI Metric not found"));

        return mapToResponse(metric);
    }

    @Override
    public KpiMetricResponse create(KpiMetricRequest request) {

        KraArea kraArea = kraAreaRepository.findById(request.getKraAreaId())
                .orElseThrow(() -> new RuntimeException("KRA Area not found"));

        KpiMetric metric = KpiMetric.builder()
                .kraArea(kraArea)
                .name(request.getName())
                .targetExpression(request.getTargetExpression())
                .direction(request.getDirection())
                .targetValue(request.getTargetValue())
                .warnThreshold(request.getWarnThreshold())
                .criticalThreshold(request.getCriticalThreshold())
                .unit(request.getUnit())
                .frequency(request.getFrequency())
                .sourceSystem(request.getSourceSystem())
                .sourceReference(request.getSourceReference())
                .measurementInstruction(request.getMeasurementInstruction())
                .isActive(request.getIsActive())
                .build();

        metric = kpiMetricRepository.save(metric);

        return mapToResponse(metric);
    }

    @Override
    public KpiMetricResponse update(Integer id, KpiMetricRequest request) {

        return null;
    }

    @Override
    public void delete(Integer id) {

    }

    private KpiMetricResponse mapToResponse(KpiMetric metric) {

        return KpiMetricResponse.builder()
                .id(metric.getId())
                .kraAreaId(metric.getKraArea().getId())
                .name(metric.getName())
                .targetExpression(metric.getTargetExpression())
                .direction(metric.getDirection())
                .targetValue(metric.getTargetValue())
                .warnThreshold(metric.getWarnThreshold())
                .criticalThreshold(metric.getCriticalThreshold())
                .unit(metric.getUnit())
                .frequency(metric.getFrequency())
                .sourceSystem(metric.getSourceSystem())
                .sourceReference(metric.getSourceReference())
                .measurementInstruction(metric.getMeasurementInstruction())
                .isActive(metric.getIsActive())
                .version(metric.getVersion())
                .createdAt(metric.getCreatedAt())
                .updatedAt(metric.getUpdatedAt())
                .build();
    }
}
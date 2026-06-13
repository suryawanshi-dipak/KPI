package com.kpi.service.impl;

import com.kpi.dto.request.KpiMeasurementRequest;
import com.kpi.dto.response.KpiMeasurementResponse;
import com.kpi.entity.Employee;
import com.kpi.entity.KpiMeasurement;
import com.kpi.entity.KpiMetric;
import com.kpi.entity.enums.MeasurementStatus;
import com.kpi.exception.ResourceNotFoundException;
import com.kpi.repository.EmployeeRepository;
import com.kpi.repository.KpiMeasurementRepository;
import com.kpi.repository.KpiMetricRepository;
import com.kpi.service.KpiMeasurementService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class KpiMeasurementServiceImpl implements KpiMeasurementService {

    private final KpiMeasurementRepository measurementRepository;
    private final KpiMetricRepository kpiMetricRepository;
    private final EmployeeRepository employeeRepository;

    @Override
    public List<KpiMeasurementResponse> getAll() {
        return measurementRepository.findAllWithDetails().stream()
                .map(this::toResponse).toList();
    }

    @Override
    public KpiMeasurementResponse getById(Long id) {
        return toResponse(findOrThrow(id));
    }

    @Override
    public List<KpiMeasurementResponse> getByMetricId(Integer metricId) {
        return measurementRepository.findByMetricIdWithDetails(metricId).stream()
                .map(this::toResponse).toList();
    }

    @Override
    public List<KpiMeasurementResponse> getByStatus(MeasurementStatus status) {
        return measurementRepository.findByStatusWithDetails(status).stream()
                .map(this::toResponse).toList();
    }

    @Override
    public List<KpiMeasurementResponse> getPending() {
        return measurementRepository.findAllPendingWithDetails().stream()
                .map(this::toResponse).toList();
    }

    @Override
    @Transactional
    public KpiMeasurementResponse create(KpiMeasurementRequest request) {
        KpiMetric metric = kpiMetricRepository.findByIdAndIsDeletedFalse(request.getKpiMetricId())
                .orElseThrow(() -> new ResourceNotFoundException("KPI Metric", request.getKpiMetricId()));
        Employee measuredBy = employeeRepository.findById(request.getMeasuredById())
                .orElseThrow(() -> new ResourceNotFoundException("Employee", request.getMeasuredById()));

        KpiMeasurement.KpiMeasurementBuilder builder = KpiMeasurement.builder()
                .kpiMetric(metric)
                .kpiMetricVersion(metric.getVersion())
                .measuredValue(request.getMeasuredValue())
                .measurementPeriodType(request.getMeasurementPeriodType())
                .measurementPeriodLabel(request.getMeasurementPeriodLabel())
                .periodStartDate(request.getPeriodStartDate())
                .periodEndDate(request.getPeriodEndDate())
                .status(request.getStatus())
                .measurementNote(request.getMeasurementNote())
                .rawPayload(request.getRawPayload())
                .postAction(request.getPostAction())
                .measuredAt(LocalDateTime.now())
                .measuredBy(measuredBy)
                .isSystemGenerated(request.getIsSystemGenerated() != null ? request.getIsSystemGenerated() : false)
                .isPending(request.getIsPending() != null ? request.getIsPending() : false)
                .pendingReason(request.getPendingReason());

        if (request.getCorrectedFromId() != null) {
            KpiMeasurement original = measurementRepository.findById(request.getCorrectedFromId())
                    .orElseThrow(() -> new ResourceNotFoundException("KPI Measurement", request.getCorrectedFromId()));
            builder.correctedFrom(original).isCorrected(true);
        }

        return toResponse(measurementRepository.save(builder.build()));
    }

    @Override
    @Transactional
    public KpiMeasurementResponse update(Long id, KpiMeasurementRequest request) {
        KpiMeasurement measurement = findOrThrow(id);

        KpiMetric metric = kpiMetricRepository.findByIdAndIsDeletedFalse(request.getKpiMetricId())
                .orElseThrow(() -> new ResourceNotFoundException("KPI Metric", request.getKpiMetricId()));
        Employee measuredBy = employeeRepository.findById(request.getMeasuredById())
                .orElseThrow(() -> new ResourceNotFoundException("Employee", request.getMeasuredById()));

        measurement.setKpiMetric(metric);
        measurement.setKpiMetricVersion(metric.getVersion());
        measurement.setMeasuredValue(request.getMeasuredValue());
        measurement.setMeasurementPeriodType(request.getMeasurementPeriodType());
        measurement.setMeasurementPeriodLabel(request.getMeasurementPeriodLabel());
        measurement.setPeriodStartDate(request.getPeriodStartDate());
        measurement.setPeriodEndDate(request.getPeriodEndDate());
        measurement.setStatus(request.getStatus());
        measurement.setMeasurementNote(request.getMeasurementNote());
        measurement.setRawPayload(request.getRawPayload());
        measurement.setPostAction(request.getPostAction());
        measurement.setMeasuredBy(measuredBy);
        if (request.getIsSystemGenerated() != null) measurement.setIsSystemGenerated(request.getIsSystemGenerated());
        if (request.getIsPending() != null) measurement.setIsPending(request.getIsPending());
        measurement.setPendingReason(request.getPendingReason());

        return toResponse(measurementRepository.save(measurement));
    }

    @Override
    @Transactional
    public void delete(Long id) {
        KpiMeasurement measurement = findOrThrow(id);
        measurement.setIsDeleted(true);
        measurementRepository.save(measurement);
    }

    private KpiMeasurement findOrThrow(Long id) {
        return measurementRepository.findByIdWithDetails(id)
                .orElseThrow(() -> new ResourceNotFoundException("KPI Measurement", id));
    }

    private KpiMeasurementResponse toResponse(KpiMeasurement m) {
        String measuredByName = resolveEmployeeName(m.getMeasuredBy());
        return KpiMeasurementResponse.builder()
                .id(m.getId())
                .kpiMetricId(m.getKpiMetric().getId())
                .kpiMetricName(m.getKpiMetric().getName())
                .kraAreaId(m.getKpiMetric().getKraArea().getId())
                .kraAreaName(m.getKpiMetric().getKraArea().getAreaName())
                .kpiMetricVersion(m.getKpiMetricVersion())
                .measuredValue(m.getMeasuredValue())
                .measurementPeriodType(m.getMeasurementPeriodType())
                .measurementPeriodLabel(m.getMeasurementPeriodLabel())
                .periodStartDate(m.getPeriodStartDate())
                .periodEndDate(m.getPeriodEndDate())
                .status(m.getStatus())
                .measurementNote(m.getMeasurementNote())
                .rawPayload(m.getRawPayload())
                .postAction(m.getPostAction())
                .measuredAt(m.getMeasuredAt())
                .measuredById(m.getMeasuredBy().getId())
                .measuredByName(measuredByName)
                .isSystemGenerated(m.getIsSystemGenerated())
                .isPending(m.getIsPending())
                .pendingReason(m.getPendingReason())
                .isCorrected(m.getIsCorrected())
                .correctedFromId(m.getCorrectedFrom() != null ? m.getCorrectedFrom().getId() : null)
                .createdAt(m.getCreatedAt())
                .updatedAt(m.getUpdatedAt())
                .createdBy(m.getCreatedBy())
                .updatedBy(m.getUpdatedBy())
                .build();
    }

    private String resolveEmployeeName(Employee e) {
        if (e.getFirstName() != null) {
            String full = e.getFirstName();
            if (e.getLastName() != null) full += " " + e.getLastName();
            return full;
        }
        return e.getName() != null ? e.getName() : e.getEmail();
    }
}

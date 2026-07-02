package com.kpi.service.impl;

import com.kpi.dto.request.KraAreaRequest;
import com.kpi.dto.response.KraAreaResponse;
import com.kpi.entity.KraArea;
import com.kpi.exception.ResourceNotFoundException;
import com.kpi.repository.KpiEmployeeAssignmentRepository;
import com.kpi.repository.KpiMeasurementRepository;
import com.kpi.repository.KpiMetricRepository;
import com.kpi.repository.KraAreaRepository;
import com.kpi.service.KraAreaService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class KraAreaServiceImpl implements KraAreaService {

    private final KraAreaRepository kraAreaRepository;
    private final KpiMetricRepository kpiMetricRepository;
    private final KpiMeasurementRepository kpiMeasurementRepository;
    private final KpiEmployeeAssignmentRepository kpiEmployeeAssignmentRepository;

    @Override
    public List<KraAreaResponse> getAll(boolean activeOnly) {
        List<KraArea> areas = activeOnly
                ? kraAreaRepository.findAllByIsDeletedFalseAndIsActiveTrueOrderBySortOrderAsc()
                : kraAreaRepository.findAllByIsDeletedFalseOrderBySortOrderAsc();
        return areas.stream().map(this::toResponse).toList();
    }

    @Override
    public KraAreaResponse getById(Integer id) {
        return toResponse(findOrThrow(id));
    }

    @Override
    @Transactional
    public KraAreaResponse create(KraAreaRequest request) {
        KraArea area = KraArea.builder()
                .areaName(request.getAreaName())
                .sortOrder(request.getSortOrder())
                .financialYear(request.getFinancialYear())
                .isActive(request.getIsActive() != null ? request.getIsActive() : true)
                .build();
        return toResponse(kraAreaRepository.save(area));
    }

    @Override
    @Transactional
    public KraAreaResponse update(Integer id, KraAreaRequest request) {
        KraArea area = findOrThrow(id);
        area.setAreaName(request.getAreaName());
        area.setSortOrder(request.getSortOrder());
        area.setFinancialYear(request.getFinancialYear());
        if (request.getIsActive() != null) {
            area.setIsActive(request.getIsActive());
        }
        return toResponse(kraAreaRepository.save(area));
    }

    @Override
    @Transactional
    public void delete(Integer id) {
        KraArea area = findOrThrow(id);
        // Soft delete the KRA area first.
        area.setIsDeleted(true);
        kraAreaRepository.save(area);
        // Then cascade the soft delete through child entities in order.
        kpiMeasurementRepository.softDeleteByKraAreaId(id);
        kpiEmployeeAssignmentRepository.softDeleteByKraAreaId(id);
        kpiMetricRepository.softDeleteByKraAreaId(id);
    }

    private KraArea findOrThrow(Integer id) {
        return kraAreaRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("KRA Area", id));
    }

    private KraAreaResponse toResponse(KraArea area) {
        return KraAreaResponse.builder()
                .id(area.getId())
                .sortOrder(area.getSortOrder())
                .areaName(area.getAreaName())
                .financialYear(area.getFinancialYear())
                .isActive(area.getIsActive())
                .createdAt(area.getCreatedAt())
                .updatedAt(area.getUpdatedAt())
                .createdBy(area.getCreatedBy())
                .updatedBy(area.getUpdatedBy())
                .build();
    }
}

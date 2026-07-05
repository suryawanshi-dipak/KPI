package com.kpi.service.impl;

import com.kpi.dto.request.KpiAssignmentRequest;
import com.kpi.dto.response.KpiAssignmentResponse;
import com.kpi.entity.Employee;
import com.kpi.entity.KpiEmployeeAssignment;
import com.kpi.entity.KpiMetric;
import com.kpi.exception.ResourceNotFoundException;
import com.kpi.repository.EmployeeRepository;
import com.kpi.repository.KpiEmployeeAssignmentRepository;
import com.kpi.repository.KpiMetricRepository;
import com.kpi.service.KpiAssignmentService;
import com.kpi.util.EmployeeUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class KpiAssignmentServiceImpl implements KpiAssignmentService {

    private final KpiEmployeeAssignmentRepository assignmentRepository;
    private final KpiMetricRepository kpiMetricRepository;
    private final EmployeeRepository employeeRepository;

    @Override
    public List<KpiAssignmentResponse> getAll() {
        return assignmentRepository.findAllWithDetails().stream()
                .map(this::toResponse).toList();
    }

    @Override
    public KpiAssignmentResponse getById(Integer id) {
        return toResponse(findOrThrow(id));
    }

    @Override
    public List<KpiAssignmentResponse> getByMetricId(Integer metricId) {
        return assignmentRepository.findByMetricIdWithDetails(metricId).stream()
                .map(this::toResponse).toList();
    }

    @Override
    public List<KpiAssignmentResponse> getByEmployeeId(Integer employeeId) {
        return assignmentRepository.findByEmployeeIdWithDetails(employeeId).stream()
                .map(this::toResponse).toList();
    }

    private Integer getCurrentUserEmployeeId() {
        try {
            org.springframework.security.core.Authentication auth = 
                org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.isAuthenticated()) {
                String email = auth.getName();
                return employeeRepository.findByEmail(email)
                        .map(com.kpi.entity.Employee::getId)
                        .orElse(null);
            }
        } catch (Exception e) {
            // Ignore
        }
        return null;
    }

    @Override
    @Transactional
    public KpiAssignmentResponse create(KpiAssignmentRequest request) {
        // Validate if this KPI is already assigned to this employee/user
        if (assignmentRepository.existsByKpiMetricIdAndEmployeeIdAndIsDeletedFalse(request.getKpiMetricId(), request.getEmployeeId())) {
            throw new IllegalArgumentException("this KPI is already assigned to the User");
        }

        KpiMetric metric = kpiMetricRepository.findByIdAndIsDeletedFalse(request.getKpiMetricId())
                .orElseThrow(() -> new ResourceNotFoundException("KPI Metric", request.getKpiMetricId()));
        Employee employee = employeeRepository.findById(request.getEmployeeId())
                .orElseThrow(() -> new ResourceNotFoundException("Employee", request.getEmployeeId()));

        KpiEmployeeAssignment assignment = KpiEmployeeAssignment.builder()
                .kpiMetric(metric)
                .employee(employee)
                .team(request.getTeam())
                .isPrimary(request.getIsPrimary() != null ? request.getIsPrimary() : false)
                .assignedFrom(request.getAssignedFrom())
                .assignedTo(request.getAssignedTo())
                .createdBy(getCurrentUserEmployeeId())
                .updatedBy(getCurrentUserEmployeeId())
                .build();

        return toResponse(assignmentRepository.save(assignment));
    }

    @Override
    @Transactional
    public KpiAssignmentResponse update(Integer id, KpiAssignmentRequest request) {
        KpiEmployeeAssignment assignment = findOrThrow(id);

        // Validate if this KPI is already assigned to this employee/user (excluding the current assignment)
        if (assignmentRepository.existsByKpiMetricIdAndEmployeeIdAndIdNotAndIsDeletedFalse(request.getKpiMetricId(), request.getEmployeeId(), id)) {
            throw new IllegalArgumentException("this KPI is already assigned to the User");
        }

        KpiMetric metric = kpiMetricRepository.findByIdAndIsDeletedFalse(request.getKpiMetricId())
                .orElseThrow(() -> new ResourceNotFoundException("KPI Metric", request.getKpiMetricId()));
        Employee employee = employeeRepository.findById(request.getEmployeeId())
                .orElseThrow(() -> new ResourceNotFoundException("Employee", request.getEmployeeId()));

        assignment.setKpiMetric(metric);
        assignment.setEmployee(employee);
        assignment.setTeam(request.getTeam());
        if (request.getIsPrimary() != null) assignment.setIsPrimary(request.getIsPrimary());
        assignment.setAssignedFrom(request.getAssignedFrom());
        assignment.setAssignedTo(request.getAssignedTo());
        assignment.setUpdatedBy(getCurrentUserEmployeeId());

        return toResponse(assignmentRepository.save(assignment));
    }


    @Override
    @Transactional
    public void delete(Integer id) {
        KpiEmployeeAssignment assignment = findOrThrow(id);
        assignment.setIsDeleted(true);
        assignmentRepository.save(assignment);
    }

    private KpiEmployeeAssignment findOrThrow(Integer id) {
        return assignmentRepository.findByIdWithDetails(id)
                .orElseThrow(() -> new ResourceNotFoundException("KPI Assignment", id));
    }

    private KpiAssignmentResponse toResponse(KpiEmployeeAssignment a) {
        return KpiAssignmentResponse.builder()
                .id(a.getId())
                .kpiMetricId(a.getKpiMetric().getId())
                .kpiMetricName(a.getKpiMetric().getName())
                .kraAreaId(a.getKpiMetric().getKraArea().getId())
                .kraAreaName(a.getKpiMetric().getKraArea().getAreaName())
                .employeeId(a.getEmployee().getId())
                .employeeName(EmployeeUtils.resolveName(a.getEmployee()))
                .team(a.getTeam())
                .isPrimary(a.getIsPrimary())
                .assignedFrom(a.getAssignedFrom())
                .assignedTo(a.getAssignedTo())
                .createdAt(a.getCreatedAt())
                .updatedAt(a.getUpdatedAt())
                .createdBy(a.getCreatedBy())
                .updatedBy(a.getUpdatedBy())
                .build();
    }

}

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

    @Override
    @Transactional
    public KpiAssignmentResponse create(KpiAssignmentRequest request) {
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
                .build();

        return toResponse(assignmentRepository.save(assignment));
    }

    @Override
    @Transactional
    public KpiAssignmentResponse update(Integer id, KpiAssignmentRequest request) {
        KpiEmployeeAssignment assignment = findOrThrow(id);

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
        String empName = resolveEmployeeName(a.getEmployee());
        return KpiAssignmentResponse.builder()
                .id(a.getId())
                .kpiMetricId(a.getKpiMetric().getId())
                .kpiMetricName(a.getKpiMetric().getName())
                .kraAreaId(a.getKpiMetric().getKraArea().getId())
                .kraAreaName(a.getKpiMetric().getKraArea().getAreaName())
                .employeeId(a.getEmployee().getId())
                .employeeName(empName)
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

    private String resolveEmployeeName(Employee e) {
        if (e.getFirstName() != null) {
            String full = e.getFirstName();
            if (e.getLastName() != null) full += " " + e.getLastName();
            return full;
        }
        return e.getName() != null ? e.getName() : e.getEmail();
    }
}

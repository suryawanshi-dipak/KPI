package com.kpi.service.impl;

import com.kpi.dto.response.EmployeeResponse;
import com.kpi.entity.Employee;
import com.kpi.exception.ResourceNotFoundException;
import com.kpi.repository.EmployeeRepository;
import com.kpi.service.EmployeeService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class EmployeeServiceImpl implements EmployeeService {

    private final EmployeeRepository employeeRepository;

    @Override
    public List<EmployeeResponse> getAll() {
        return employeeRepository.findAll().stream().map(this::toResponse).toList();
    }

    @Override
    public EmployeeResponse getById(Integer id) {
        return employeeRepository.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> new ResourceNotFoundException("Employee", id));
    }

    private EmployeeResponse toResponse(Employee e) {
        String fullName = ((e.getFirstName() != null ? e.getFirstName() : "") + " "
                + (e.getLastName() != null ? e.getLastName() : "")).trim();
        if (fullName.isEmpty() && e.getName() != null) fullName = e.getName();

        return EmployeeResponse.builder()
                .id(e.getId())
                .name(fullName.isEmpty() ? e.getEmail() : fullName)
                .email(e.getEmail())
                .designation(e.getDesignation())
                .department(e.getDepartment())
                .build();
    }
}

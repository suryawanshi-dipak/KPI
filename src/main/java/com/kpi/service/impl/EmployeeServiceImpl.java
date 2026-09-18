package com.kpi.service.impl;

import com.kpi.dto.request.EmployeeRequest;
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

    
    @Override
    public List<EmployeeResponse> getEmployeesByManager(Integer managerId) {
        return employeeRepository.findByManager_Id(managerId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    public EmployeeResponse getByEmployeeId(String employeeId) {
        return employeeRepository.findByEmployeeId(employeeId)
                .map(this::toResponse)
                .orElseThrow(() -> new ResourceNotFoundException("Employee", employeeId));
    }

    @Override
    public EmployeeResponse update(Integer id, EmployeeRequest request) {
        Employee e = employeeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Employee", id));

        e.setEmployeeId(request.getEmployeeId());
        e.setEmail(request.getEmail());
        applyNameParts(e, request.getName());

        e.setRole(request.getRole());
        e.setDepartment(request.getDepartment());
        e.setDesignation(request.getDesignation());
        
        if (request.getManagerId() != null) {
            Employee manager = employeeRepository.findById(request.getManagerId())
                    .orElseThrow(() -> new ResourceNotFoundException("Manager", request.getManagerId()));
            e.setManager(manager);
        } else {
            e.setManager(null);
        }
        
        e.setPhone(request.getPhone());
        e.setJoinedOn(request.getJoinedOn());
        e.setGender(request.getGender());
        e.setStatus(request.getStatus());

        // Only set when HRMS is propagating an actual password change — never blank
        // this out on an ordinary info-only sync where the field is simply absent.
        if (request.getPasswordHash() != null && !request.getPasswordHash().isBlank()) {
            e.setPasswordHash(request.getPasswordHash());
        }

        Employee saved = employeeRepository.save(e);
        return toResponse(saved);
    }

    /** Splits a full display name into first/middle/last, mirroring HRMS's own convention. */
    private void applyNameParts(Employee e, String name) {
        e.setName(name);
        if (name != null && !name.trim().isEmpty()) {
            String[] parts = name.trim().split("\\s+");
            e.setFirstName(parts[0]);
            e.setLastName(parts.length > 1 ? parts[parts.length - 1] : "");
            if (parts.length > 2) {
                StringBuilder middle = new StringBuilder();
                for (int i = 1; i < parts.length - 1; i++) {
                    if (i > 1) middle.append(" ");
                    middle.append(parts[i]);
                }
                e.setMiddleName(middle.toString());
            } else {
                e.setMiddleName("");
            }
        } else {
            e.setFirstName("");
            e.setLastName("");
            e.setMiddleName("");
        }
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
                .managerId(
                    e.getManager() != null
                        ? e.getManager().getId()
                        : null
                )
                .role(e.getRole().name())
                .employeeId(e.getEmployeeId())
                .phone(e.getPhone())
                .joinedOn(e.getJoinedOn())
                .gender(e.getGender())
                .status(e.getStatus() != null ? e.getStatus().name() : null)
                .build();
    }
}

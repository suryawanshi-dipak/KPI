package com.kpi.service;

import com.kpi.dto.request.EmployeeRequest;
import com.kpi.dto.response.EmployeeResponse;

import java.util.List;

public interface EmployeeService {

    List<EmployeeResponse> getAll();

    EmployeeResponse getById(Integer id);

    List<EmployeeResponse> getEmployeesByManager(Integer managerId);

    // Lookup by the shared HRMS employee code (e.g. "VT001") rather than KPI's
    // own internal id — used by the HRMS -> KPI sync to resolve which KPI record
    // (subject or manager) an update targets.
    EmployeeResponse getByEmployeeId(String employeeId);

    // Update existing employee's details
    EmployeeResponse update(Integer id, EmployeeRequest request);
}

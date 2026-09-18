package com.kpi.controller;

import com.kpi.dto.request.EmployeeRequest;
import com.kpi.dto.response.ApiResponse;
import com.kpi.dto.response.EmployeeResponse;
import com.kpi.service.EmployeeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/employees")
@RequiredArgsConstructor
public class EmployeeController {

    private final EmployeeService employeeService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<EmployeeResponse>>> getAll() {
        return ResponseEntity.ok(ApiResponse.success(employeeService.getAll()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<EmployeeResponse>> getById(@PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.success(employeeService.getById(id)));
    }

    @GetMapping("/manager/{managerId}")
    public ResponseEntity<ApiResponse<List<EmployeeResponse>>> getEmployeesByManager(@PathVariable Integer managerId) {
        List<EmployeeResponse> employees = employeeService.getEmployeesByManager(managerId);
        return ResponseEntity.ok(ApiResponse.success(employees));
    }

    // Lookup by the shared HRMS employee code (e.g. "VT001") rather than KPI's own id.
    // Same auth level as the other GETs above (any authenticated user) — used by HRMS's
    // employee-update sync to resolve KPI's internal id before calling PUT /{id}.
    @GetMapping("/by-code/{employeeId}")
    public ResponseEntity<ApiResponse<EmployeeResponse>> getByEmployeeId(@PathVariable String employeeId) {
        return ResponseEntity.ok(ApiResponse.success(employeeService.getByEmployeeId(employeeId)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<EmployeeResponse>> update(@PathVariable Integer id, @RequestBody EmployeeRequest request) {
        return ResponseEntity.ok(ApiResponse.success(employeeService.update(id, request)));
    }
}

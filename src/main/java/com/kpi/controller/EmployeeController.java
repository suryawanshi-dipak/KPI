package com.kpi.controller;

import com.kpi.dto.response.ApiResponse;
import com.kpi.dto.response.EmployeeResponse;
import com.kpi.service.EmployeeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
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
public ResponseEntity<ApiResponse<List<EmployeeResponse>>> getEmployeesByManager( @PathVariable Integer managerId) {

    List<EmployeeResponse> employees = employeeService.getEmployeesByManager(managerId);

    return ResponseEntity.ok(ApiResponse.success(employees) );
}
}

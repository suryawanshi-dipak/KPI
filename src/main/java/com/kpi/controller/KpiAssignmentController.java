package com.kpi.controller;

import com.kpi.dto.request.KpiAssignmentRequest;
import com.kpi.dto.response.ApiResponse;
import com.kpi.dto.response.KpiAssignmentResponse;
import com.kpi.service.KpiAssignmentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/kpi-assignments")
@RequiredArgsConstructor
public class KpiAssignmentController {

    private final KpiAssignmentService assignmentService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<KpiAssignmentResponse>>> getAll() {
        return ResponseEntity.ok(ApiResponse.success(assignmentService.getAll()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<KpiAssignmentResponse>> getById(@PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.success(assignmentService.getById(id)));
    }

    @GetMapping("/metric/{metricId}")
    public ResponseEntity<ApiResponse<List<KpiAssignmentResponse>>> getByMetricId(@PathVariable Integer metricId) {
        return ResponseEntity.ok(ApiResponse.success(assignmentService.getByMetricId(metricId)));
    }

    @GetMapping("/employee/{employeeId}")
    public ResponseEntity<ApiResponse<List<KpiAssignmentResponse>>> getByEmployeeId(@PathVariable Integer employeeId) {
        return ResponseEntity.ok(ApiResponse.success(assignmentService.getByEmployeeId(employeeId)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<KpiAssignmentResponse>> create(@Valid @RequestBody KpiAssignmentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Assignment created successfully", assignmentService.create(request)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<KpiAssignmentResponse>> update(
            @PathVariable Integer id, @Valid @RequestBody KpiAssignmentRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Assignment updated successfully", assignmentService.update(id, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Integer id) {
        assignmentService.delete(id);
        return ResponseEntity.ok(ApiResponse.success("Assignment deleted successfully", null));
    }
}

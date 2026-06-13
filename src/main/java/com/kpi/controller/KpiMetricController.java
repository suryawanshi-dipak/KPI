package com.kpi.controller;
import com.kpi.dto.request.KpiMetricRequest;
import com.kpi.dto.response.ApiResponse;
import com.kpi.dto.response.KpiMetricResponse;
import com.kpi.service.KpiMetricService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/kpi-metrics")
@RequiredArgsConstructor
public class KpiMetricController {

    private final KpiMetricService kpiMetricService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<KpiMetricResponse>>> getAll(
            @RequestParam(defaultValue = "false") boolean activeOnly) {
        return ResponseEntity.ok(ApiResponse.success(kpiMetricService.getAll(activeOnly)));
    } 
    
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<KpiMetricResponse>> getById(@PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.success(kpiMetricService.getById(id)));
    }    

    @PostMapping
    public ResponseEntity<ApiResponse<KpiMetricResponse>> create(@Valid @RequestBody KpiMetricRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("KPI Metric created successfully", kpiMetricService.create(request)));
    }   
    
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<KpiMetricResponse>> update(
            @PathVariable Integer id, @Valid @RequestBody KpiMetricRequest request) {
        return ResponseEntity.ok(ApiResponse.success("KPI Metric updated successfully", kpiMetricService.update(id, request)));
    }    

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Integer id) {
        kpiMetricService.delete(id);
        return ResponseEntity.ok(ApiResponse.success("KPI Metric deleted successfully", null));
    }    
    
}

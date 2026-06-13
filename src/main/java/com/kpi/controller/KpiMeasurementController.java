package com.kpi.controller;

import com.kpi.dto.request.KpiMeasurementRequest;
import com.kpi.dto.response.ApiResponse;
import com.kpi.dto.response.KpiMeasurementResponse;
import com.kpi.entity.enums.MeasurementStatus;
import com.kpi.service.KpiMeasurementService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/kpi-measurements")
@RequiredArgsConstructor
public class KpiMeasurementController {

    private final KpiMeasurementService measurementService;

    // Single list endpoint: ?metricId= and ?status= are optional filters; no params returns all records
    @GetMapping
    public ResponseEntity<ApiResponse<List<KpiMeasurementResponse>>> getAll(
            @RequestParam(required = false) Integer metricId,
            @RequestParam(required = false) MeasurementStatus status) {

        List<KpiMeasurementResponse> result;
        if (metricId != null) {
            result = measurementService.getByMetricId(metricId);
        } else if (status != null) {
            result = measurementService.getByStatus(status);
        } else {
            result = measurementService.getAll();
        }
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<KpiMeasurementResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(measurementService.getById(id)));
    }

    @GetMapping("/pending")
    public ResponseEntity<ApiResponse<List<KpiMeasurementResponse>>> getPending() {
        return ResponseEntity.ok(ApiResponse.success(measurementService.getPending()));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<KpiMeasurementResponse>> create(@Valid @RequestBody KpiMeasurementRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Measurement recorded successfully", measurementService.create(request)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<KpiMeasurementResponse>> update(
            @PathVariable Long id, @Valid @RequestBody KpiMeasurementRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Measurement updated successfully", measurementService.update(id, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        measurementService.delete(id);
        return ResponseEntity.ok(ApiResponse.success("Measurement deleted successfully", null));
    }
}

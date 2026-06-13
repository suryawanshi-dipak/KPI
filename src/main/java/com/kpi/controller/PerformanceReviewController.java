package com.kpi.controller;

import com.kpi.dto.request.PerformanceReviewRequest;
import com.kpi.dto.response.ApiResponse;
import com.kpi.dto.response.PerformanceReviewResponse;
import com.kpi.entity.enums.ReviewStatus;
import com.kpi.service.PerformanceReviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/performance-reviews")
@RequiredArgsConstructor
public class PerformanceReviewController {

    private final PerformanceReviewService reviewService;

    // Single list endpoint: ?employeeId= and ?status= are optional filters; no params returns all records
    @GetMapping
    public ResponseEntity<ApiResponse<List<PerformanceReviewResponse>>> getAll(
            @RequestParam(required = false) Integer employeeId,
            @RequestParam(required = false) ReviewStatus status) {

        List<PerformanceReviewResponse> result;
        if (employeeId != null) {
            result = reviewService.getByEmployeeId(employeeId);
        } else if (status != null) {
            result = reviewService.getByStatus(status);
        } else {
            result = reviewService.getAll();
        }
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<PerformanceReviewResponse>> getById(@PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.success(reviewService.getById(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<PerformanceReviewResponse>> create(@Valid @RequestBody PerformanceReviewRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Performance review created successfully", reviewService.create(request)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<PerformanceReviewResponse>> update(
            @PathVariable Integer id, @Valid @RequestBody PerformanceReviewRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Performance review updated successfully", reviewService.update(id, request)));
    }

    @PatchMapping("/{id}/submit")
    public ResponseEntity<ApiResponse<PerformanceReviewResponse>> submit(@PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.success("Performance review submitted", reviewService.submit(id)));
    }

    @PatchMapping("/{id}/approve")
    public ResponseEntity<ApiResponse<PerformanceReviewResponse>> approve(@PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.success("Performance review approved", reviewService.approve(id)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Integer id) {
        reviewService.delete(id);
        return ResponseEntity.ok(ApiResponse.success("Performance review deleted successfully", null));
    }
}

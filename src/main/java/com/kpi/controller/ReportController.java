package com.kpi.controller;

import com.kpi.dto.response.ApiResponse;
import com.kpi.dto.response.ExecutiveSummaryResponse;
import com.kpi.dto.response.KpiHealthReportResponse;
import com.kpi.service.ReportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Controller exposing REST endpoints to fetch data for the Report Tab.
 */
@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    /**
     * Endpoint to fetch the list of unique period labels available in the database.
     * Used by the UI to populate the period selection dropdown.
     *
     * GET /api/v1/reports/periods
     *
     * @return a list of unique period labels
     */
    @GetMapping("/periods")
    public ResponseEntity<ApiResponse<List<String>>> getPeriods() {
        List<String> periods = reportService.getUniquePeriodLabels();
        return ResponseEntity.ok(ApiResponse.success("Periods retrieved successfully", periods));
    }

    /**
     * Endpoint to retrieve the Executive Summary report for a specific period.
     *
     * GET /api/v1/reports/executive-summary?periodLabel={label}
     *
     * @param periodLabel the period indicator (e.g. "Q1-FY2026")
     * @return the computed Executive Summary metrics
     */
    @GetMapping("/executive-summary")
    public ResponseEntity<ApiResponse<ExecutiveSummaryResponse>> getExecutiveSummary(
            @RequestParam String periodLabel) {
        ExecutiveSummaryResponse summary = reportService.getExecutiveSummary(periodLabel);
        return ResponseEntity.ok(ApiResponse.success("Executive Summary compiled successfully", summary));
    }

    /**
     * Endpoint to retrieve the KPI Health report for a specific period.
     *
     * GET /api/v1/reports/kpi-health?periodLabel={label}
     *
     * @param periodLabel the period indicator (e.g. "Q1-FY2026")
     * @return the grouped KPI health report details
     */
    @GetMapping("/kpi-health")
    public ResponseEntity<ApiResponse<KpiHealthReportResponse>> getKpiHealthReport(
            @RequestParam String periodLabel) {
        KpiHealthReportResponse report = reportService.getKpiHealthReport(periodLabel);
        return ResponseEntity.ok(ApiResponse.success("KPI Health Report compiled successfully", report));
    }
}

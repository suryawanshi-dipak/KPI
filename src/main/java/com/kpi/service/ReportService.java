package com.kpi.service;

import com.kpi.dto.response.ExecutiveSummaryResponse;
import com.kpi.dto.response.KpiHealthReportResponse;

import java.util.List;

/**
 * Service interface for generating KPI and KRA reports.
 */
public interface ReportService {

    /**
     * Generates the high-level Executive Summary report for a specific period.
     *
     * @param periodLabel the period identifier (e.g. "Q1-FY2026")
     * @return the computed Executive Summary response containing status counts, KRA averages, pending items, and watchlist
     */
    ExecutiveSummaryResponse getExecutiveSummary(String periodLabel);

    /**
     * Generates the detailed KPI Health report for a specific period.
     * Groups KPIs under KRA areas and exposes assignee-level logs.
     *
     * @param periodLabel the period identifier (e.g. "Q1-FY2026")
     * @return the structured KPI health response
     */
    KpiHealthReportResponse getKpiHealthReport(String periodLabel);

    /**
     * Retrieves all unique period labels currently present in recorded measurements.
     * Used to populate dropdown selectors on the frontend.
     *
     * @return a list of unique period labels sorted in descending order
     */
    List<String> getUniquePeriodLabels();
}

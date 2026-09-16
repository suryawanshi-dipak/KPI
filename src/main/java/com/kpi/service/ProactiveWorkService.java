package com.kpi.service;

import com.kpi.dto.request.ProactiveWorkEntryRequest;
import com.kpi.dto.response.ProactiveWorkEntryResponse;
import com.kpi.dto.response.ProactiveWorkEntrySummaryResponse;

import java.util.Collection;
import java.util.List;
import java.util.Map;

public interface ProactiveWorkService {

    ProactiveWorkEntryResponse create(ProactiveWorkEntryRequest request);

    /** subjectEmployeeIdFilter narrows the caller's visible scope; it can never widen it. */
    List<ProactiveWorkEntryResponse> list(Integer subjectEmployeeIdFilter, Boolean unseenOnly, Boolean highlightedOnly);

    /** Marks the entry seen once, only for a viewer who is not the subject. */
    ProactiveWorkEntryResponse getByIdAndMarkSeen(Long id);

    /** Manager/admin only — see BRD §8.3 RBAC matrix (Seen/Highlight: Employee = No). */
    ProactiveWorkEntryResponse setHighlighted(Long id, boolean highlighted);

    /** RBAC-filtered, batched lookup used by KpiMeasurementServiceImpl for the KPI-detail widget. */
    Map<Long, List<ProactiveWorkEntrySummaryResponse>> findVisibleSummariesForMeasurements(Collection<Long> measurementIds);
}

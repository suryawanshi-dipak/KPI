package com.kpi.service;

import com.kpi.dto.request.ProactiveWorkCommentRequest;
import com.kpi.dto.request.ProactiveWorkEntryRequest;
import com.kpi.dto.response.PagedResponse;
import com.kpi.dto.response.ProactiveWorkCommentResponse;
import com.kpi.dto.response.ProactiveWorkEntryResponse;
import com.kpi.dto.response.ProactiveWorkEntrySummaryResponse;

import java.util.Collection;
import java.util.List;
import java.util.Map;

public interface ProactiveWorkService {

    ProactiveWorkEntryResponse create(ProactiveWorkEntryRequest request);

    /** Author or admin only. Title/category are rejected if changed once endorsementCount > 0
     *  (admin may still override). Subject/credit-to is never changed by an edit. */
    ProactiveWorkEntryResponse update(Long id, ProactiveWorkEntryRequest request);

    /** subjectEmployeeIdFilter narrows the caller's visible scope; it can never widen it.
     *  Backs both the "My team" tab (filter omitted) and "Mine" (filter = caller's own id). */
    List<ProactiveWorkEntryResponse> list(Integer subjectEmployeeIdFilter, Boolean unseenOnly, Boolean highlightedOnly);

    /** The org-wide "Everyone" feed — every role, ORGANISATION-visibility entries only, paged. */
    PagedResponse<ProactiveWorkEntryResponse> listEveryone(int page, int size, Boolean unseenOnly, Boolean highlightedOnly);

    /** Marks the entry seen once, only when the viewer is specifically the subject's own
     *  manager or an admin — org-wide visibility means many managers can open the same entry,
     *  and only the subject's own counts as FR-PW-06's signal. Returns the full detail shape. */
    ProactiveWorkEntryResponse getByIdAndMarkSeen(Long id);

    /** The subject's own manager or an admin only — same "whose manager" restriction as seen. */
    ProactiveWorkEntryResponse setHighlighted(Long id, boolean highlighted);

    /** Anyone who can view the entry, except its subject. No-op on a PRIVATE entry — the
     *  endorse control doesn't exist there regardless of who's asking. Not audited. */
    ProactiveWorkEntryResponse setEndorsed(Long id, boolean endorsed);

    ProactiveWorkCommentResponse addComment(Long entryId, ProactiveWorkCommentRequest request);

    /** Author only. */
    ProactiveWorkCommentResponse editComment(Long commentId, ProactiveWorkCommentRequest request);

    /** Author or admin. Soft-delete — the row stays so the thread around it still makes sense. */
    void deleteComment(Long commentId);

    /** RBAC-filtered, batched lookup used by KpiMeasurementServiceImpl for the KPI-detail widget. */
    Map<Long, List<ProactiveWorkEntrySummaryResponse>> findVisibleSummariesForMeasurements(Collection<Long> measurementIds);
}

package com.kpi.controller;

import com.kpi.dto.request.ProactiveWorkCommentRequest;
import com.kpi.dto.request.ProactiveWorkEndorsementRequest;
import com.kpi.dto.request.ProactiveWorkEntryRequest;
import com.kpi.dto.request.ProactiveWorkHighlightRequest;
import com.kpi.dto.response.ApiResponse;
import com.kpi.dto.response.PagedResponse;
import com.kpi.dto.response.ProactiveWorkCommentResponse;
import com.kpi.dto.response.ProactiveWorkEntryResponse;
import com.kpi.service.ProactiveWorkService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Proactive Work Log — v1 (Increment 1: FR-PW-01, 02, 04, 06, 07, 08, 09, 12) plus v2 (peer
 * endorsement + comments, edit-from-detail, Admin Team Summary, the value-statement field).
 */
@RestController
@RequestMapping("/api/v1/proactive-work")
@RequiredArgsConstructor
public class ProactiveWorkController {

    private final ProactiveWorkService proactiveWorkService;

    /** "My team" (scope omitted, the default) and "Mine" (subjectEmployeeId = caller's own id)
     *  tabs — both unpaged, matching every other list in this app. "Everyone" is a separate
     *  endpoint below since it's paged and open to every role regardless of team membership. */
    @GetMapping
    public ResponseEntity<ApiResponse<List<ProactiveWorkEntryResponse>>> list(
            @RequestParam(required = false) Integer subjectEmployeeId,
            @RequestParam(required = false) Boolean unseenOnly,
            @RequestParam(required = false) Boolean highlightedOnly) {
        return ResponseEntity.ok(ApiResponse.success(
                proactiveWorkService.list(subjectEmployeeId, unseenOnly, highlightedOnly)));
    }

    /** The org-wide "Everyone" feed — every role, ORGANISATION-visibility entries only, paged. */
    @GetMapping("/everyone")
    public ResponseEntity<ApiResponse<PagedResponse<ProactiveWorkEntryResponse>>> listEveryone(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(required = false) Boolean unseenOnly,
            @RequestParam(required = false) Boolean highlightedOnly) {
        return ResponseEntity.ok(ApiResponse.success(
                proactiveWorkService.listEveryone(page, size, unseenOnly, highlightedOnly)));
    }

    /** Also the FR-PW-06 auto-seen trigger — see ProactiveWorkServiceImpl#getByIdAndMarkSeen. */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ProactiveWorkEntryResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(proactiveWorkService.getByIdAndMarkSeen(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ProactiveWorkEntryResponse>> create(
            @RequestBody ProactiveWorkEntryRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Proactive work entry logged successfully", proactiveWorkService.create(request)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<ProactiveWorkEntryResponse>> update(
            @PathVariable Long id, @RequestBody ProactiveWorkEntryRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                "Proactive work entry updated successfully", proactiveWorkService.update(id, request)));
    }

    @PatchMapping("/{id}/highlight")
    public ResponseEntity<ApiResponse<ProactiveWorkEntryResponse>> setHighlighted(
            @PathVariable Long id, @RequestBody ProactiveWorkHighlightRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                proactiveWorkService.setHighlighted(id, Boolean.TRUE.equals(request.getHighlighted()))));
    }

    @PatchMapping("/{id}/endorsement")
    public ResponseEntity<ApiResponse<ProactiveWorkEntryResponse>> setEndorsed(
            @PathVariable Long id, @RequestBody ProactiveWorkEndorsementRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                proactiveWorkService.setEndorsed(id, Boolean.TRUE.equals(request.getEndorsed()))));
    }

    @PostMapping("/{id}/comments")
    public ResponseEntity<ApiResponse<ProactiveWorkCommentResponse>> addComment(
            @PathVariable Long id, @RequestBody ProactiveWorkCommentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(proactiveWorkService.addComment(id, request)));
    }

    @PutMapping("/comments/{commentId}")
    public ResponseEntity<ApiResponse<ProactiveWorkCommentResponse>> editComment(
            @PathVariable Long commentId, @RequestBody ProactiveWorkCommentRequest request) {
        return ResponseEntity.ok(ApiResponse.success(proactiveWorkService.editComment(commentId, request)));
    }

    @DeleteMapping("/comments/{commentId}")
    public ResponseEntity<ApiResponse<Void>> deleteComment(@PathVariable Long commentId) {
        proactiveWorkService.deleteComment(commentId);
        return ResponseEntity.ok(ApiResponse.success("Comment deleted", null));
    }
}

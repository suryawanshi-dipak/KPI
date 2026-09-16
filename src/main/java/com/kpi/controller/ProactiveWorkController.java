package com.kpi.controller;

import com.kpi.dto.request.ProactiveWorkEntryRequest;
import com.kpi.dto.request.ProactiveWorkHighlightRequest;
import com.kpi.dto.response.ApiResponse;
import com.kpi.dto.response.ProactiveWorkEntryResponse;
import com.kpi.service.ProactiveWorkService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Increment 1 of the Proactive Work Log (BRD v2.0 §4.1): FR-PW-01, 02, 04, 06, 07, 08, 09, 12. */
@RestController
@RequestMapping("/api/v1/proactive-work")
@RequiredArgsConstructor
public class ProactiveWorkController {

    private final ProactiveWorkService proactiveWorkService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ProactiveWorkEntryResponse>>> list(
            @RequestParam(required = false) Integer subjectEmployeeId,
            @RequestParam(required = false) Boolean unseenOnly,
            @RequestParam(required = false) Boolean highlightedOnly) {
        return ResponseEntity.ok(ApiResponse.success(
                proactiveWorkService.list(subjectEmployeeId, unseenOnly, highlightedOnly)));
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

    @PatchMapping("/{id}/highlight")
    public ResponseEntity<ApiResponse<ProactiveWorkEntryResponse>> setHighlighted(
            @PathVariable Long id, @RequestBody ProactiveWorkHighlightRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                proactiveWorkService.setHighlighted(id, Boolean.TRUE.equals(request.getHighlighted()))));
    }
}

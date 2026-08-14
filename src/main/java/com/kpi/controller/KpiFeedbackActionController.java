package com.kpi.controller;

import com.kpi.dto.request.FeedbackVerificationRequest;
import com.kpi.dto.request.JiraStatusUpdateRequest;
import com.kpi.dto.request.KpiFeedbackActionRequest;
import com.kpi.dto.response.ApiResponse;
import com.kpi.dto.response.KpiFeedbackActionResponse;
import com.kpi.entity.KpiFeedbackAction.VerificationResult;
import com.kpi.service.KpiFeedbackActionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** REST endpoints for the KPI feedback and remediation-action workflow. */
@RestController
@RequestMapping("/api/v1/kpi-feedback-actions")
@RequiredArgsConstructor
public class KpiFeedbackActionController {

    private final KpiFeedbackActionService feedbackActionService;

    /** Lists active actions; either optional filter can be used for targeted Postman tests. */
    @GetMapping
    public ResponseEntity<ApiResponse<List<KpiFeedbackActionResponse>>> getAll(
            @RequestParam(required = false) Long kpiMeasurementId,
            @RequestParam(required = false) VerificationResult verificationResult) {

        List<KpiFeedbackActionResponse> result;
        if (kpiMeasurementId != null) {
            result = feedbackActionService.getByKpiMeasurementId(kpiMeasurementId);
        } else if (verificationResult != null) {
            result = feedbackActionService.getByVerificationResult(verificationResult);
        } else {
            result = feedbackActionService.getAll();
        }
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /** Gets one active remediation action by its primary key. */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<KpiFeedbackActionResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(feedbackActionService.getById(id)));
    }

    /** Creates a new feedback/remediation action. */
    @PostMapping
    public ResponseEntity<ApiResponse<KpiFeedbackActionResponse>> create(
            @Valid @RequestBody KpiFeedbackActionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("KPI feedback action created successfully", feedbackActionService.create(request)));
    }

    /** Replaces all editable fields of an existing feedback/remediation action. */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<KpiFeedbackActionResponse>> update(
            @PathVariable Long id, @Valid @RequestBody KpiFeedbackActionRequest request) {
        return ResponseEntity.ok(
                ApiResponse.success("KPI feedback action updated successfully", feedbackActionService.update(id, request)));
    }

    /** Updates a Jira status snapshot independently of the full feedback-action payload. */
    @PatchMapping("/{id}/jira-status")
    public ResponseEntity<ApiResponse<KpiFeedbackActionResponse>> updateJiraStatus(
            @PathVariable Long id, @Valid @RequestBody JiraStatusUpdateRequest request) {
        return ResponseEntity.ok(
                ApiResponse.success("Jira status updated successfully", feedbackActionService.updateJiraStatus(id, request)));
    }

    /** Records the verification outcome after remediation work has been carried out. */
    @PatchMapping("/{id}/verification")
    public ResponseEntity<ApiResponse<KpiFeedbackActionResponse>> recordVerification(
            @PathVariable Long id, @Valid @RequestBody FeedbackVerificationRequest request) {
        return ResponseEntity.ok(
                ApiResponse.success("Verification result recorded successfully", feedbackActionService.recordVerification(id, request)));
    }

    /** Soft deletes an action while preserving its database row for audit/history purposes. */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        feedbackActionService.delete(id);
        return ResponseEntity.ok(ApiResponse.success("KPI feedback action deleted successfully", null));
    }
}

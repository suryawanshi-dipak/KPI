package com.kpi.service;

import com.kpi.dto.request.FeedbackVerificationRequest;
import com.kpi.dto.request.JiraStatusUpdateRequest;
import com.kpi.dto.request.KpiFeedbackActionRequest;
import com.kpi.dto.response.KpiFeedbackActionResponse;
import com.kpi.entity.KpiFeedbackAction.VerificationResult;

import java.util.List;

/** Business contract for KPI feedback and remediation actions. */
public interface KpiFeedbackActionService {

    List<KpiFeedbackActionResponse> getAll();

    KpiFeedbackActionResponse getById(Long id);

    List<KpiFeedbackActionResponse> getByKpiMeasurementId(Long kpiMeasurementId);

    List<KpiFeedbackActionResponse> getByVerificationResult(VerificationResult verificationResult);

    KpiFeedbackActionResponse create(KpiFeedbackActionRequest request);

    KpiFeedbackActionResponse update(Long id, KpiFeedbackActionRequest request);

    KpiFeedbackActionResponse updateJiraStatus(Long id, JiraStatusUpdateRequest request);

    KpiFeedbackActionResponse recordVerification(Long id, FeedbackVerificationRequest request);

    void delete(Long id);
}

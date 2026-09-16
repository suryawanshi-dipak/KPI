package com.kpi.service.impl;

import com.kpi.dto.response.KpiFeedbackActionResponse;
import com.kpi.entity.Employee;
import com.kpi.entity.KpiFeedbackAction;
import com.kpi.entity.KpiFeedbackAction.JiraResolutionCategory;
import com.kpi.entity.KpiFeedbackAction.VerificationResult;
import com.kpi.exception.ResourceNotFoundException;
import com.kpi.repository.EmployeeRepository;
import com.kpi.repository.KpiFeedbackActionRepository;
import com.kpi.service.JiraSyncService;
import com.kpi.util.EmployeeUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@Service
@Transactional
public class JiraSyncServiceImpl implements JiraSyncService {

    private static final Logger log = LoggerFactory.getLogger(JiraSyncServiceImpl.class);

    private final KpiFeedbackActionRepository feedbackActionRepository;
    private final EmployeeRepository employeeRepository;
    private final RestTemplate restTemplate;

    @Value("${jira.base-url}")
    private String jiraBaseUrl;

    @Value("${jira.token}")
    private String jiraToken;

    @Value("${jira.email:}")
    private String jiraEmail;

    @Value("${jira.status-mapping.fixed}")
    private String fixedStatusesRaw;

    @Value("${jira.status-mapping.not-fixed}")
    private String notFixedStatusesRaw;

    public JiraSyncServiceImpl(KpiFeedbackActionRepository feedbackActionRepository,
                               EmployeeRepository employeeRepository) {
        this.feedbackActionRepository = feedbackActionRepository;
        this.employeeRepository = employeeRepository;
        this.restTemplate = new RestTemplate();
    }

    @Override
    public KpiFeedbackActionResponse syncJiraStatus(Long id) {
        KpiFeedbackAction action = feedbackActionRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new ResourceNotFoundException("KPI Feedback Action", id));

        if (action.getLinkedJiraIssueKey() == null || action.getLinkedJiraIssueKey().trim().isEmpty()) {
            return toResponse(action);
        }

        try {
            String url = jiraBaseUrl + "/api/v1/mock-jira/issue/" + action.getLinkedJiraIssueKey();
            if (!jiraBaseUrl.contains("localhost") && !jiraBaseUrl.contains("127.0.0.1")) {
                url = jiraBaseUrl + "/rest/api/2/issue/" + action.getLinkedJiraIssueKey();
            }

            HttpHeaders headers = new HttpHeaders();
boolean isMock = jiraBaseUrl.contains("localhost") || jiraBaseUrl.contains("127.0.0.1");

if (isMock) {
    if (jiraToken != null && !jiraToken.trim().isEmpty() && !jiraToken.equals("mock_token")) {
        headers.set("Authorization", "Bearer " + jiraToken);
    }
} else {
    // Real Jira Cloud requires Basic Auth: base64(email:api_token)
    String credentials = jiraEmail + ":" + jiraToken;
    String encoded = java.util.Base64.getEncoder().encodeToString(credentials.getBytes());
    headers.set("Authorization", "Basic " + encoded);
}

            HttpEntity<Void> entity = new HttpEntity<>(headers);
            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, entity, Map.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> body = response.getBody();
                Map<String, Object> fields = (Map<String, Object>) body.get("fields");
                if (fields != null) {
                    Map<String, Object> status = (Map<String, Object>) fields.get("status");
                    if (status != null) {
                        String statusName = (String) status.get("name");
                        if (statusName != null) {
                            updateActionJiraStatus(action, statusName);
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to sync Jira status for action id: {} key: {}. Error: {}", 
                    id, action.getLinkedJiraIssueKey(), e.getMessage());
            // Graceful handling: do not overwrite previously cached data or throw exception
        }

        return toResponse(feedbackActionRepository.save(action));
    }

    private void updateActionJiraStatus(KpiFeedbackAction action, String statusName) {
        List<String> fixedList = Arrays.stream(fixedStatusesRaw.split(","))
                .map(String::trim)
                .map(String::toLowerCase)
                .toList();

        List<String> notFixedList = Arrays.stream(notFixedStatusesRaw.split(","))
                .map(String::trim)
                .map(String::toLowerCase)
                .toList();

        action.setJiraStatusSnapshot(statusName);
        action.setJiraStatusLastSyncedAt(LocalDateTime.now());

        String statusLower = statusName.toLowerCase();
        if (fixedList.contains(statusLower)) {
            action.setJiraResolutionCategory(JiraResolutionCategory.fixed);
            if (action.getJiraResolvedAt() == null) {
                action.setJiraResolvedAt(LocalDateTime.now());
            }
        } else if (notFixedList.contains(statusLower)) {
            action.setJiraResolutionCategory(JiraResolutionCategory.not_fixed);
            if (action.getJiraResolvedAt() == null) {
                action.setJiraResolvedAt(LocalDateTime.now());
            }
            // Sets verification_result = not_verifiable immediately without waiting for next measurement
            action.setVerificationResult(VerificationResult.not_verifiable);
            action.setVerificationCheckedAt(LocalDateTime.now());
        } else {
            // Non-terminal
            action.setJiraResolutionCategory(null);
            action.setJiraResolvedAt(null);
        }
        action.setUpdatedAt(LocalDateTime.now());
        action.setUpdatedBy(resolveCurrentUserEmployeeId());
    }

    private Integer resolveCurrentUserEmployeeId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return null;
        }
        return employeeRepository.findByEmail(authentication.getName())
                .map(Employee::getId)
                .orElse(null);
    }

    private KpiFeedbackActionResponse toResponse(KpiFeedbackAction action) {
        String submittedByName = employeeRepository.findById(action.getSubmittedBy())
                .map(EmployeeUtils::resolveName)
                .orElse(null);

        return KpiFeedbackActionResponse.builder()
                .id(action.getId())
                .kpiMeasurementId(action.getKpiMeasurementId())
                .rootCauseSummary(action.getRootCauseSummary())
                .linkedJiraIssueKey(action.getLinkedJiraIssueKey())
                .submittedBy(action.getSubmittedBy())
                .submittedByName(submittedByName)
                .submittedAt(action.getSubmittedAt())
                .jiraStatusSnapshot(action.getJiraStatusSnapshot())
                .jiraStatusLastSyncedAt(action.getJiraStatusLastSyncedAt())
                .jiraResolvedAt(action.getJiraResolvedAt())
                .jiraResolutionCategory(action.getJiraResolutionCategory())
                .verificationResult(action.getVerificationResult())
                .verificationKpiMeasurementId(action.getVerificationKpiMeasurementId())
                .verificationCheckedAt(action.getVerificationCheckedAt())
                .relatedPreviousFeedbackId(action.getRelatedPreviousFeedbackId())
                .createdAt(action.getCreatedAt())
                .updatedAt(action.getUpdatedAt())
                .createdBy(action.getCreatedBy())
                .updatedBy(action.getUpdatedBy())
                .build();
    }
}

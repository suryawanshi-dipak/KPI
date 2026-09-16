package com.kpi.service;

import com.kpi.dto.response.KpiFeedbackActionResponse;

public interface JiraSyncService {
    KpiFeedbackActionResponse syncJiraStatus(Long id);
}

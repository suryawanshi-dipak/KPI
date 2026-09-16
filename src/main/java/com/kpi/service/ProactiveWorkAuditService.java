package com.kpi.service;

import com.kpi.entity.enums.ProactiveWorkAuditActionType;

import java.util.Map;

public interface ProactiveWorkAuditService {

    /** Always called from within the caller's already-open @Transactional method, so the save
     *  joins that same transaction — no REQUIRES_NEW, no separate commit. */
    void record(Long entryId, ProactiveWorkAuditActionType actionType, Integer actorId,
                Map<String, Object> oldValues, Map<String, Object> newValues);
}

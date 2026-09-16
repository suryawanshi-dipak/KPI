package com.kpi.service.impl;

import com.kpi.entity.ProactiveWorkEntryAudit;
import com.kpi.entity.enums.ProactiveWorkAuditActionType;
import com.kpi.repository.ProactiveWorkEntryAuditRepository;
import com.kpi.service.ProactiveWorkAuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ProactiveWorkAuditServiceImpl implements ProactiveWorkAuditService {

    private final ProactiveWorkEntryAuditRepository auditRepository;

    @Override
    public void record(Long entryId, ProactiveWorkAuditActionType actionType, Integer actorId,
                        Map<String, Object> oldValues, Map<String, Object> newValues) {
        if (actorId == null) {
            throw new IllegalStateException("A proactive work audit entry requires the employee who made the change");
        }
        Map<String, Object> changed = new LinkedHashMap<>();
        if (oldValues != null) changed.put("before", oldValues);
        if (newValues != null) changed.put("after", newValues);

        ProactiveWorkEntryAudit audit = ProactiveWorkEntryAudit.builder()
                .entryId(entryId)
                .actionType(actionType)
                .actorId(actorId)
                .changedFields(changed)
                .createdAt(LocalDateTime.now())
                .build();
        auditRepository.save(audit);
    }
}

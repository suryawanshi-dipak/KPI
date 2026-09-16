package com.kpi.repository;

import com.kpi.entity.ProactiveWorkEntryAudit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProactiveWorkEntryAuditRepository extends JpaRepository<ProactiveWorkEntryAudit, Long> {

    List<ProactiveWorkEntryAudit> findByEntryIdOrderByCreatedAtDesc(Long entryId);
}

package com.kpi.repository;

import com.kpi.entity.KpiFeedbackActionAudit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface KpiFeedbackActionAuditRepository extends JpaRepository<KpiFeedbackActionAudit, Long> {
}

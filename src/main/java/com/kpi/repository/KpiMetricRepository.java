package com.kpi.repository;

import com.kpi.entity.KpiMetric;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface KpiMetricRepository extends JpaRepository<KpiMetric, Integer> {

    // JOIN FETCH eliminates N+1 on kraArea lazy load
    @Query("SELECT m FROM KpiMetric m JOIN FETCH m.kraArea WHERE m.isDeleted = false ORDER BY m.id ASC")
    List<KpiMetric> findAllWithKraArea();

    @Query("SELECT m FROM KpiMetric m JOIN FETCH m.kraArea WHERE m.isDeleted = false AND m.isActive = true ORDER BY m.id ASC")
    List<KpiMetric> findAllActiveWithKraArea();

    @Modifying
    @Transactional
    // Soft delete all KPI metrics that belong to a deleted KRA area.
    // This ensures the KRA delete path cascades down to KPI metric rows.
    @Query("""
            UPDATE KpiMetric k
            SET k.isDeleted = true
            WHERE k.kraArea.id = :kraAreaId
            """)
    void softDeleteByKraAreaId(@Param("kraAreaId") Integer kraAreaId);

    Optional<KpiMetric> findByIdAndIsDeletedFalse(Integer id);
}

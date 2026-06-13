package com.kpi.repository;

import com.kpi.entity.KpiMetric;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.Optional;

public interface KpiMetricRepository extends JpaRepository<KpiMetric, Integer> {

    // JOIN FETCH eliminates N+1 on kraArea lazy load
    @Query("SELECT m FROM KpiMetric m JOIN FETCH m.kraArea WHERE m.isDeleted = false ORDER BY m.id ASC")
    List<KpiMetric> findAllWithKraArea();

    @Query("SELECT m FROM KpiMetric m JOIN FETCH m.kraArea WHERE m.isDeleted = false AND m.isActive = true ORDER BY m.id ASC")
    List<KpiMetric> findAllActiveWithKraArea();

    Optional<KpiMetric> findByIdAndIsDeletedFalse(Integer id);
}

package com.kpi.repository;

import com.kpi.entity.KpiMetric;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface KpiMetricRepository extends JpaRepository<KpiMetric, Integer> {

    List<KpiMetric> findAllByIsDeletedFalse();

    List<KpiMetric> findAllByIsDeletedFalseAndIsActiveTrue();

    Optional<KpiMetric> findByIdAndIsDeletedFalse(Integer id);
}

package com.kpi.repository;

import com.kpi.entity.KpiMeasurement;
import com.kpi.entity.enums.MeasurementStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface KpiMeasurementRepository extends JpaRepository<KpiMeasurement, Long> {

       // JOIN FETCH on metric, kraArea and measuredBy — avoids 3 separate lazy loads
       // per row
       @Query("SELECT m FROM KpiMeasurement m " +
                     "JOIN FETCH m.kpiMetric km JOIN FETCH km.kraArea " +
                     "JOIN FETCH m.measuredBy " +
                     "WHERE m.isDeleted = false ORDER BY m.measuredAt DESC")
       List<KpiMeasurement> findAllWithDetails();

       @Query("SELECT m FROM KpiMeasurement m " +
                     "JOIN FETCH m.kpiMetric km JOIN FETCH km.kraArea " +
                     "JOIN FETCH m.measuredBy " +
                     "WHERE m.kpiMetric.id = :metricId AND m.isDeleted = false ORDER BY m.measuredAt DESC")
       List<KpiMeasurement> findByMetricIdWithDetails(@Param("metricId") Integer metricId);

       @Modifying
       @Transactional
       // Soft delete all measurements for a KPI metric that was deleted.
       @Query("UPDATE KpiMeasurement m SET m.isDeleted = true WHERE m.kpiMetric.id = :metricId")
       void softDeleteByMetricId(@Param("metricId") Integer metricId);

       @Modifying
       @Transactional
       // Soft delete all measurements for KPI metrics that belong to a deleted KRA
       // area.
       @Query("UPDATE KpiMeasurement m SET m.isDeleted = true WHERE m.kpiMetric.kraArea.id = :kraAreaId")
       void softDeleteByKraAreaId(@Param("kraAreaId") Integer kraAreaId);

       @Query("SELECT m FROM KpiMeasurement m " +
                     "JOIN FETCH m.kpiMetric km JOIN FETCH km.kraArea " +
                     "JOIN FETCH m.measuredBy " +
                     "WHERE m.status = :status AND m.isDeleted = false ORDER BY m.measuredAt DESC")
       List<KpiMeasurement> findByStatusWithDetails(@Param("status") MeasurementStatus status);

       @Query("SELECT m FROM KpiMeasurement m " +
                     "JOIN FETCH m.kpiMetric km JOIN FETCH km.kraArea " +
                     "JOIN FETCH m.measuredBy " +
                     "WHERE m.id = :id AND m.isDeleted = false")
       Optional<KpiMeasurement> findByIdWithDetails(@Param("id") Long id);

       @Query("SELECT m FROM KpiMeasurement m " +
                     "JOIN FETCH m.kpiMetric km JOIN FETCH km.kraArea " +
                     "JOIN FETCH m.measuredBy " +
                     "WHERE m.isPending = true AND m.isDeleted = false ORDER BY m.measuredAt DESC")
       List<KpiMeasurement> findAllPendingWithDetails();
}

package com.kpi.repository;

import com.kpi.entity.KpiEmployeeAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface KpiEmployeeAssignmentRepository extends JpaRepository<KpiEmployeeAssignment, Integer> {

    // Single JOIN FETCH loads metric + kraArea + employee in one query
    @Query("SELECT a FROM KpiEmployeeAssignment a " +
           "JOIN FETCH a.kpiMetric km JOIN FETCH km.kraArea " +
           "JOIN FETCH a.employee " +
           "WHERE a.isDeleted = false ORDER BY a.id ASC")
    List<KpiEmployeeAssignment> findAllWithDetails();

    @Query("SELECT a FROM KpiEmployeeAssignment a " +
           "JOIN FETCH a.kpiMetric km JOIN FETCH km.kraArea " +
           "JOIN FETCH a.employee " +
           "WHERE a.kpiMetric.id = :metricId AND a.isDeleted = false ORDER BY a.id ASC")
    List<KpiEmployeeAssignment> findByMetricIdWithDetails(@Param("metricId") Integer metricId);

    @Query("SELECT a FROM KpiEmployeeAssignment a " +
           "JOIN FETCH a.kpiMetric km JOIN FETCH km.kraArea " +
           "JOIN FETCH a.employee " +
           "WHERE a.employee.id = :employeeId AND a.isDeleted = false ORDER BY a.id ASC")
    List<KpiEmployeeAssignment> findByEmployeeIdWithDetails(@Param("employeeId") Integer employeeId);

    @Query("SELECT a FROM KpiEmployeeAssignment a " +
           "JOIN FETCH a.kpiMetric km JOIN FETCH km.kraArea " +
           "JOIN FETCH a.employee " +
           "WHERE a.id = :id AND a.isDeleted = false")
    Optional<KpiEmployeeAssignment> findByIdWithDetails(@Param("id") Integer id);
}

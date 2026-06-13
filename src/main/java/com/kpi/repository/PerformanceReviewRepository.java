package com.kpi.repository;

import com.kpi.entity.PerformanceReview;
import com.kpi.entity.enums.ReviewStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PerformanceReviewRepository extends JpaRepository<PerformanceReview, Integer> {

    // LEFT JOIN FETCH on reviewer because reviewer_id is nullable
    @Query("SELECT pr FROM PerformanceReview pr " +
           "JOIN FETCH pr.employee " +
           "LEFT JOIN FETCH pr.reviewer " +
           "WHERE pr.isDeleted = false ORDER BY pr.createdAt DESC")
    List<PerformanceReview> findAllWithDetails();

    @Query("SELECT pr FROM PerformanceReview pr " +
           "JOIN FETCH pr.employee " +
           "LEFT JOIN FETCH pr.reviewer " +
           "WHERE pr.employee.id = :employeeId AND pr.isDeleted = false ORDER BY pr.createdAt DESC")
    List<PerformanceReview> findByEmployeeIdWithDetails(@Param("employeeId") Integer employeeId);

    @Query("SELECT pr FROM PerformanceReview pr " +
           "JOIN FETCH pr.employee " +
           "LEFT JOIN FETCH pr.reviewer " +
           "WHERE pr.status = :status AND pr.isDeleted = false ORDER BY pr.createdAt DESC")
    List<PerformanceReview> findByStatusWithDetails(@Param("status") ReviewStatus status);

    @Query("SELECT pr FROM PerformanceReview pr " +
           "JOIN FETCH pr.employee " +
           "LEFT JOIN FETCH pr.reviewer " +
           "WHERE pr.id = :id AND pr.isDeleted = false")
    Optional<PerformanceReview> findByIdWithDetails(@Param("id") Integer id);
}

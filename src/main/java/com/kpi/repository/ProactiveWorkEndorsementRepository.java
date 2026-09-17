package com.kpi.repository;

import com.kpi.entity.ProactiveWorkEndorsement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProactiveWorkEndorsementRepository extends JpaRepository<ProactiveWorkEndorsement, Long> {

    Optional<ProactiveWorkEndorsement> findByEntryIdAndEmployeeId(Long entryId, Integer employeeId);

    @Query("SELECT e FROM ProactiveWorkEndorsement e WHERE e.entryId = :entryId AND e.withdrawnAt IS NULL " +
           "ORDER BY e.createdAt ASC")
    List<ProactiveWorkEndorsement> findActiveByEntryId(@Param("entryId") Long entryId);

    long countByEntryIdAndWithdrawnAtIsNull(Long entryId);
}

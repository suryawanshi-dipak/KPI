package com.kpi.repository;

import com.kpi.entity.KraArea;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface KraAreaRepository extends JpaRepository<KraArea, Integer> {

    List<KraArea> findAllByIsDeletedFalseOrderBySortOrderAsc();

    List<KraArea> findAllByIsDeletedFalseAndIsActiveTrueOrderBySortOrderAsc();

    Optional<KraArea> findByIdAndIsDeletedFalse(Integer id);
}

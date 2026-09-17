package com.kpi.repository;

import com.kpi.entity.NotificationPreference;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface NotificationPreferenceRepository extends JpaRepository<NotificationPreference, Integer> {

    Optional<NotificationPreference> findByEmployeeId(Integer employeeId);
}

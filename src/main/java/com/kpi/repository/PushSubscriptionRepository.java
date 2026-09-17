package com.kpi.repository;

import com.kpi.entity.PushSubscription;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, Long> {

    Optional<PushSubscription> findByEndpoint(String endpoint);

    List<PushSubscription> findByEmployeeIdAndRevokedAtIsNull(Integer employeeId);

    void deleteByEndpoint(String endpoint);
}

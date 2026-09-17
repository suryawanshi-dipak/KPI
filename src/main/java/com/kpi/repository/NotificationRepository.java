package com.kpi.repository;

import com.kpi.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    Page<Notification> findByRecipientIdOrderByCreatedAtDesc(Integer recipientId, Pageable pageable);

    long countByRecipientIdAndReadAtIsNull(Integer recipientId);

    @Modifying
    @Query("UPDATE Notification n SET n.readAt = :now WHERE n.recipientId = :recipientId AND n.readAt IS NULL")
    int markAllRead(@Param("recipientId") Integer recipientId, @Param("now") LocalDateTime now);

    @Query("SELECT DISTINCT n.recipientId FROM Notification n WHERE n.pushedAt IS NULL")
    List<Integer> findDistinctRecipientIdsWithPendingPush();

    List<Notification> findByRecipientIdAndPushedAtIsNull(Integer recipientId);
}

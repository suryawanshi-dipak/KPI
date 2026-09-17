package com.kpi.repository;

import com.kpi.entity.ProactiveWorkEntry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ProactiveWorkEntryRepository extends JpaRepository<ProactiveWorkEntry, Long> {

    Optional<ProactiveWorkEntry> findByIdAndIsDeletedFalse(Long id);

    List<ProactiveWorkEntry> findByIsDeletedFalseOrderByEffortStartDateDescCreatedAtDesc();

    List<ProactiveWorkEntry> findBySubjectEmployeeIdAndIsDeletedFalseOrderByEffortStartDateDescCreatedAtDesc(
            Integer subjectEmployeeId);

    // Explicit @Query rather than a derived findBySubjectEmployeeIdOrLoggedByIdAndIsDeletedFalse
    // method name — Spring Data parses "FindByAOrBAndC" as "A OR (B AND C)", not "(A OR B) AND
    // C", which would silently leak soft-deleted rows logged by the caller. An employee's own
    // list must include entries they logged for someone else, not just ones they're the subject
    // of — otherwise crediting a peer makes the entry vanish from the logger's own view.
    @Query("SELECT e FROM ProactiveWorkEntry e WHERE e.isDeleted = false " +
           "AND (e.subjectEmployeeId = :employeeId OR e.loggedById = :employeeId) " +
           "ORDER BY e.effortStartDate DESC, e.createdAt DESC")
    List<ProactiveWorkEntry> findBySubjectOrLoggedByAndIsDeletedFalse(@Param("employeeId") Integer employeeId);

    List<ProactiveWorkEntry> findBySubjectEmployeeIdInAndIsDeletedFalseOrderByEffortStartDateDescCreatedAtDesc(
            Collection<Integer> subjectEmployeeIds);

    // Backs the KPI-detail widget (FR-PW-12) — one query for every measurement on the page.
    List<ProactiveWorkEntry> findByKpiMeasurementIdInAndIsDeletedFalse(Collection<Long> kpiMeasurementIds);

    // v2 "Everyone" tab — the org-wide feed, open to every role. Filters are applied in SQL
    // (not in Java, like the other tabs) because this one is paged: filtering after paging
    // would make a page come back with fewer than `size` rows. unseenOnly/highlightedOnly pass
    // as false, not null, when the caller doesn't want that filter — MySQL/HQL boolean params
    // don't shortcut on null the way Java's does.
    @Query("SELECT e FROM ProactiveWorkEntry e WHERE e.visibility = com.kpi.entity.enums.ProactiveWorkVisibility.ORGANISATION " +
           "AND e.isDeleted = false " +
           "AND (:unseenOnly = false OR e.isSeen = false) " +
           "AND (:highlightedOnly = false OR e.isHighlighted = true) " +
           "ORDER BY e.effortStartDate DESC, e.createdAt DESC")
    Page<ProactiveWorkEntry> findEveryone(@Param("unseenOnly") boolean unseenOnly,
                                          @Param("highlightedOnly") boolean highlightedOnly,
                                          Pageable pageable);
}

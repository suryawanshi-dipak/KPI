package com.kpi.repository;

import com.kpi.entity.ProactiveWorkComment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProactiveWorkCommentRepository extends JpaRepository<ProactiveWorkComment, Long> {

    List<ProactiveWorkComment> findByEntryIdOrderByCreatedAtAsc(Long entryId);

    Optional<ProactiveWorkComment> findByIdAndIsDeletedFalse(Long id);

    long countByEntryIdAndIsDeletedFalse(Long entryId);
}

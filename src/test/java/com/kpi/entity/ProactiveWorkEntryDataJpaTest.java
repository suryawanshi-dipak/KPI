package com.kpi.entity;

import com.kpi.entity.enums.ProactiveWorkCategory;
import com.kpi.entity.enums.ProactiveWorkEntryType;
import com.kpi.entity.enums.ProactiveWorkVisibility;
import com.kpi.repository.ProactiveWorkCommentRepository;
import com.kpi.repository.ProactiveWorkEndorsementRepository;
import com.kpi.repository.ProactiveWorkEntryRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.jdbc.Sql;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Runs against a real MySQL 8 container seeded with the exact live DDL (v1 + v2 columns and the
 * two new tables), so "the mapping loads and saves" is proven against the actual schema, not
 * H2's approximation of MySQL's GENERATED ALWAYS ... STORED / json column types.
 *
 * ddl-auto is forced to `none` here (not `validate`) deliberately: @DataJpaTest validates every
 * @Entity in the app on startup, and this fixture only stands up the tables the Proactive Work
 * module needs, not the full application schema. `none` skips that unrelated validation; the
 * actual save()/findById() calls below are what prove the mapping is correct.
 */
@Testcontainers
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=none")
@Sql(scripts = "/schema/proactive_work_entry_live_schema.sql")
class ProactiveWorkEntryDataJpaTest {

    @Container
    @ServiceConnection
    static final MySQLContainer<?> MYSQL = new MySQLContainer<>("mysql:8.0")
            .withDatabaseName("kpi_monitoring_test");

    @Autowired private ProactiveWorkEntryRepository entryRepository;
    @Autowired private ProactiveWorkEndorsementRepository endorsementRepository;
    @Autowired private ProactiveWorkCommentRepository commentRepository;
    @Autowired private JdbcTemplate jdbc;

    @Test
    void savesAndReloadsMatchingTheLiveGeneratedColumn() {
        ProactiveWorkEntry standalone = ProactiveWorkEntry.builder()
                .category(ProactiveWorkCategory.TEAM_SUPPORT)
                .subjectEmployeeId(1).loggedById(1)
                .title("Covered the on-call rotation")
                .description("Filled in for a sick teammate for two days.")
                .effortStartDate(LocalDate.of(2026, 9, 1))
                .effortEndDate(LocalDate.of(2026, 9, 2))
                .visibility(ProactiveWorkVisibility.ORGANISATION)
                .isSeen(false).isHighlighted(false).isDeleted(false)
                .endorsementCount(0).commentCount(0)
                .build();
        Long standaloneId = entryRepository.save(standalone).getId();

        ProactiveWorkEntry linked = ProactiveWorkEntry.builder()
                .kpiMeasurementId(1L)
                .category(ProactiveWorkCategory.PROCESS_IMPROVEMENT)
                .subjectEmployeeId(1).loggedById(1)
                .title("Added a regression suite")
                .description("Wrote automated coverage for the release pipeline.")
                .valueStatement("Cuts release verification from a day to an hour.")
                .effortStartDate(LocalDate.of(2026, 9, 3))
                .effortEndDate(LocalDate.of(2026, 9, 3))
                .visibility(ProactiveWorkVisibility.PRIVATE)
                .isSeen(false).isHighlighted(false).isDeleted(false)
                .endorsementCount(0).commentCount(0)
                .build();
        Long linkedId = entryRepository.save(linked).getId();

        assertThat(jdbc.queryForObject(
                "SELECT entry_type FROM proactive_work_entry WHERE id = ?", String.class, standaloneId))
                .isEqualTo("STANDALONE");
        assertThat(jdbc.queryForObject(
                "SELECT entry_type FROM proactive_work_entry WHERE id = ?", String.class, linkedId))
                .isEqualTo("KPI_LINKED");

        ProactiveWorkEntry reloadedStandalone = entryRepository.findById(standaloneId).orElseThrow();
        assertThat(reloadedStandalone.getEntryType()).isEqualTo(ProactiveWorkEntryType.STANDALONE);
        assertThat(reloadedStandalone.getVisibility()).isEqualTo(ProactiveWorkVisibility.ORGANISATION);

        ProactiveWorkEntry reloadedLinked = entryRepository.findById(linkedId).orElseThrow();
        assertThat(reloadedLinked.getEntryType()).isEqualTo(ProactiveWorkEntryType.KPI_LINKED);
        assertThat(reloadedLinked.getValueStatement()).isEqualTo("Cuts release verification from a day to an hour.");
        assertThat(reloadedLinked.getVisibility()).isEqualTo(ProactiveWorkVisibility.PRIVATE);
    }

    @Test
    void jointCreditSavesAndReloadsInInsertionOrder() {
        ProactiveWorkEntry entry = ProactiveWorkEntry.builder()
                .category(ProactiveWorkCategory.TEAM_SUPPORT)
                .subjectEmployeeId(1).subjectEmployeeIds(List.of(2, 1)).loggedById(1)
                .title("Covered the release together")
                .description("Paired on the hotfix end to end.")
                .effortStartDate(LocalDate.of(2026, 9, 10))
                .effortEndDate(LocalDate.of(2026, 9, 10))
                .visibility(ProactiveWorkVisibility.ORGANISATION)
                .isSeen(false).isHighlighted(false).isDeleted(false)
                .endorsementCount(0).commentCount(0)
                .build();
        Long id = entryRepository.save(entry).getId();

        List<Integer> rawOrder = jdbc.queryForList(
                "SELECT employee_id FROM proactive_work_entry_subject WHERE entry_id = ? ORDER BY sort_order",
                Integer.class, id);
        assertThat(rawOrder).containsExactly(2, 1);

        ProactiveWorkEntry reloaded = entryRepository.findById(id).orElseThrow();
        assertThat(reloaded.getSubjectEmployeeIds()).containsExactly(2, 1);
        assertThat(reloaded.getSubjectEmployeeId()).isEqualTo(1);
    }

    @Test
    void endorsementUniqueConstraintAndSelfEndorseCheckHold() {
        ProactiveWorkEntry entry = entryRepository.save(ProactiveWorkEntry.builder()
                .category(ProactiveWorkCategory.INITIATIVE_IDEA)
                .subjectEmployeeId(1).loggedById(1)
                .title("Proposed a process change").description("Cut a manual step from the release checklist.")
                .effortStartDate(LocalDate.of(2026, 9, 5)).effortEndDate(LocalDate.of(2026, 9, 5))
                .visibility(ProactiveWorkVisibility.ORGANISATION)
                .isSeen(false).isHighlighted(false).isDeleted(false)
                .endorsementCount(0).commentCount(0)
                .build());

        ProactiveWorkEndorsement endorsement = endorsementRepository.save(ProactiveWorkEndorsement.builder()
                .entryId(entry.getId()).employeeId(2).subjectEmployeeId(1).build());

        assertThat(endorsementRepository.countByEntryIdAndWithdrawnAtIsNull(entry.getId())).isEqualTo(1L);

        assertThatSelfEndorseIsRejectedByTheDatabase(entry.getId());
        assertThatDoubleEndorsingIsRejectedByTheDatabase(entry.getId());

        endorsement.setWithdrawnAt(java.time.LocalDateTime.now());
        endorsementRepository.save(endorsement);
        assertThat(endorsementRepository.countByEntryIdAndWithdrawnAtIsNull(entry.getId())).isEqualTo(0L);
    }

    private void assertThatSelfEndorseIsRejectedByTheDatabase(Long entryId) {
        try {
            jdbc.update("INSERT INTO proactive_work_endorsement (entry_id, employee_id, subject_employee_id) VALUES (?, 1, 1)", entryId);
            org.junit.jupiter.api.Assertions.fail("expected chk_no_self_endorse to reject this row");
        } catch (org.springframework.dao.DataIntegrityViolationException expected) {
            // chk_no_self_endorse held
        }
    }

    private void assertThatDoubleEndorsingIsRejectedByTheDatabase(Long entryId) {
        try {
            jdbc.update("INSERT INTO proactive_work_endorsement (entry_id, employee_id, subject_employee_id) VALUES (?, 2, 1)", entryId);
            org.junit.jupiter.api.Assertions.fail("expected uq_entry_employee to reject this row");
        } catch (org.springframework.dao.DataIntegrityViolationException expected) {
            // uq_entry_employee held
        }
    }

    @Test
    void commentSoftDeleteKeepsRowButRepositoryHidesIt() {
        ProactiveWorkEntry entry = entryRepository.save(ProactiveWorkEntry.builder()
                .category(ProactiveWorkCategory.TEAM_SUPPORT)
                .subjectEmployeeId(1).loggedById(1)
                .title("Helped debug the payments fixture").description("Traced a flaky test to a shared fixture.")
                .effortStartDate(LocalDate.of(2026, 9, 6)).effortEndDate(LocalDate.of(2026, 9, 6))
                .visibility(ProactiveWorkVisibility.ORGANISATION)
                .isSeen(false).isHighlighted(false).isDeleted(false)
                .endorsementCount(0).commentCount(0)
                .build());

        ProactiveWorkComment comment = commentRepository.save(ProactiveWorkComment.builder()
                .entryId(entry.getId()).authorId(2).body("Worth a QA runbook entry.").isDeleted(false).build());

        comment.setIsDeleted(true);
        commentRepository.save(comment);

        assertThat(commentRepository.findByIdAndIsDeletedFalse(comment.getId())).isEmpty();
        Long rawCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM proactive_work_comment WHERE id = ?", Long.class, comment.getId());
        assertThat(rawCount).isEqualTo(1L);
    }
}

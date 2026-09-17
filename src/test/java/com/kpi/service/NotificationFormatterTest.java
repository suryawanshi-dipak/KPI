package com.kpi.service;

import com.kpi.entity.Employee;
import com.kpi.entity.ProactiveWorkEntry;
import com.kpi.entity.enums.NotificationType;
import com.kpi.entity.enums.ProactiveWorkCategory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class NotificationFormatterTest {

    private NotificationFormatter formatter;

    @BeforeEach
    void setUp() {
        formatter = new NotificationFormatter();
    }

    @Test
    void testBodyNeverContainsKpiNameOrMeasurementIdAndQuotesTitleVerbatim() {
        // Entry with a linked KPI measurement, a sensitive description, and value statement
        ProactiveWorkEntry entry = ProactiveWorkEntry.builder()
                .id(99L)
                .category(ProactiveWorkCategory.PROCESS_IMPROVEMENT)
                .title("Added a regression pass beyond the standard checklist")
                .description("Internal audit finding #4102 remediation for Q3 Jira security baseline.")
                .valueStatement("Reduced customer release defects by 45%.")
                .kpiMeasurementId(789L)
                .build();

        String body = formatter.formatBody(entry);

        // Required body format: Process Improvement — "Added a regression pass beyond the standard checklist"
        assertThat(body).isEqualTo("Process Improvement — \"Added a regression pass beyond the standard checklist\"");

        // Strict security & privacy assertions:
        assertThat(body).doesNotContain("789");
        assertThat(body).doesNotContain("KPI");
        assertThat(body).doesNotContain("measurement");
        assertThat(body).doesNotContain("Internal audit");
        assertThat(body).doesNotContain("Reduced customer release defects");
    }

    @Test
    void testFormatTitleForNewEntryAndLoggedForYou() {
        Employee dipesh = new Employee();
        dipesh.setId(12);
        dipesh.setFirstName("Dipesh");
        dipesh.setLastName("Patil");

        String titleNew = formatter.formatTitle(NotificationType.NEW_ENTRY, dipesh);
        assertThat(titleNew).isEqualTo("Dipesh Patil logged proactive work");

        String titleForYou = formatter.formatTitle(NotificationType.LOGGED_FOR_YOU, dipesh);
        assertThat(titleForYou).isEqualTo("Dipesh Patil logged proactive work for you");
    }

    @Test
    void testFormatDigestMessages() {
        String dailyTitle = formatter.formatDigestTitle(true);
        String dailyBody = formatter.formatDigestBody(40, true);

        assertThat(dailyTitle).isEqualTo("Proactive Work Daily Digest");
        assertThat(dailyBody).isEqualTo("40 people logged proactive work today.");

        String hourlyTitle = formatter.formatDigestTitle(false);
        String hourlyBody = formatter.formatDigestBody(5, false);

        assertThat(hourlyTitle).isEqualTo("Proactive Work Hourly Digest");
        assertThat(hourlyBody).isEqualTo("5 new proactive work entries logged this hour.");
    }
}

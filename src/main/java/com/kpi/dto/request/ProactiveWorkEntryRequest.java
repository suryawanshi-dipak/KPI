package com.kpi.dto.request;

import com.kpi.entity.enums.ProactiveWorkCategory;
import com.kpi.entity.enums.ProactiveWorkVisibility;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/**
 * Create-only payload — Increment 1 has no edit/delete endpoint (FR-PW-05 admin correction is
 * Phase 7 / Should Have per BRD v2.0 §4.2). The controller does not annotate this with @Valid:
 * these annotations exist for self-documentation and the unit/@DataJpaTest fixtures. Actual
 * enforcement runs in ProactiveWorkServiceImpl via an injected Validator, so it can throw the
 * field+message shape the BRD examples specify instead of the global handler's field-map shape.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProactiveWorkEntryRequest {

    @NotNull(message = "Choose who to credit this to.")
    private Integer subjectEmployeeId;

    @NotNull(message = "Category is required.")
    private ProactiveWorkCategory category;

    @Size(max = 300, message = "Keep this under 300 characters.")
    private String otherCategoryText;

    @NotBlank(message = "Tell us what you did.")
    @Size(max = 200, message = "Keep the title under 200 characters.")
    private String title;

    @NotBlank(message = "Add a few details.")
    private String description;

    // v2 — "What did it change?" Required per explicit product decision: every entry must state
    // its outcome in one line.
    @NotBlank(message = "Tell us what changed as a result.")
    @Size(max = 200, message = "Keep it under 200 characters.")
    private String valueStatement;

    // v2 — null defaults to ORGANISATION in the service (visible to everyone at Vitec).
    private ProactiveWorkVisibility visibility;

    @NotNull(message = "Pick a date.")
    private LocalDate effortStartDate;

    /** Optional; defaults to effortStartDate when the multi-day box is unticked. */
    private LocalDate effortEndDate;

    /** Optional; null means a standalone entry (FR-PW-02). */
    private Long kpiMeasurementId;
}

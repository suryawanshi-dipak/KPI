package com.kpi.dto.request;

import com.kpi.entity.KpiFeedbackAction.VerificationResult;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** Request payload for recording the KPI verification result of a remediation. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FeedbackVerificationRequest {

    /** The verified outcome of the remediation action. */
    @NotNull(message = "Verification result is required")
    private VerificationResult verificationResult;

    /** The follow-up measurement used as the verification evidence. */
    private Long verificationKpiMeasurementId;

    /** Explicit verification time; defaults to now when omitted. */
    private LocalDateTime verificationCheckedAt;
}

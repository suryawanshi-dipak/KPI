package com.kpi.dto.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProactiveWorkEndorsementRequest {
    /** Null is treated as false (withdraw). */
    private Boolean endorsed;
}

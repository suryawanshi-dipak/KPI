package com.kpi.dto.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProactiveWorkHighlightRequest {

    /** Null is treated as false by the controller (turns the highlight off). */
    private Boolean highlighted;
}

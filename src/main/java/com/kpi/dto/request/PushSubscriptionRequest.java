package com.kpi.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PushSubscriptionRequest {

    @NotBlank(message = "Endpoint is required")
    private String endpoint;

    @NotBlank(message = "p256dh is required")
    private String p256dh;

    @NotBlank(message = "auth is required")
    private String auth;

    private String userAgent;
}

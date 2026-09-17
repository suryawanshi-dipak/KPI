package com.kpi.dto.response;

import com.kpi.entity.enums.DeliveryFrequency;
import com.kpi.entity.enums.NewEntryScope;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.time.LocalTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NotificationPreferenceResponse {

    private Integer employeeId;
    private NewEntryScope newEntryScope;
    private DeliveryFrequency delivery;
    private Boolean ownActivity;
    private Boolean highlight;
    private LocalTime quietFrom;
    private LocalTime quietTo;
    private LocalDateTime permissionAskedAt;
    private boolean permissionAsked;
}

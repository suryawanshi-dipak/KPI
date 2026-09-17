package com.kpi.dto.request;

import com.kpi.entity.enums.DeliveryFrequency;
import com.kpi.entity.enums.NewEntryScope;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NotificationPreferenceRequest {

    private NewEntryScope newEntryScope;
    private DeliveryFrequency delivery;
    private Boolean ownActivity;
    private Boolean highlight;
    private LocalTime quietFrom;
    private LocalTime quietTo;
}

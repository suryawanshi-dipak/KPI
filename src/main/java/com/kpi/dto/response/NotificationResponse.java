package com.kpi.dto.response;

import com.kpi.entity.enums.NotificationType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NotificationResponse {

    private Long id;
    private Integer recipientId;
    private NotificationType type;
    private Long entryId;
    private String title;
    private String body;
    private String url;
    private LocalDateTime createdAt;
    private LocalDateTime readAt;
    private LocalDateTime pushedAt;
}

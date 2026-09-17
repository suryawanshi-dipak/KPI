package com.kpi.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProactiveWorkCommentResponse {
    private Long id;
    private Long entryId;
    private Integer authorId;
    private String authorName;
    // "Comment removed" when the underlying row is soft-deleted — the row stays so the thread
    // around it still makes sense, but the real body is withheld from the API response.
    private String body;
    private LocalDateTime createdAt;
    private LocalDateTime editedAt;
    private Boolean isDeleted;
}

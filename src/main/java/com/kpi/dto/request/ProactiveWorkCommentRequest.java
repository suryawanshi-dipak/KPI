package com.kpi.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProactiveWorkCommentRequest {

    @NotBlank(message = "Comment can't be empty.")
    @Size(max = 1000, message = "Keep it under 1000 characters.")
    private String body;
}

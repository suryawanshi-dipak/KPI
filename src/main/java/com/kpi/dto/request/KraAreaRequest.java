package com.kpi.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class KraAreaRequest {

    @NotBlank(message = "Area name is required")
    @Size(max = 200, message = "Area name must not exceed 200 characters")
    private String areaName;

    private Integer sortOrder;

    @Size(max = 10, message = "Financial year must not exceed 10 characters")
    private String financialYear;

    private Boolean isActive;
}

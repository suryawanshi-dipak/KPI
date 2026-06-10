package com.kpi.dto.response;

import lombok.*;

@Getter
@Setter
@AllArgsConstructor
@Builder
public class LoginResponse {

    private String token;

    private String email;

    private String role;

    private String name;

    private Integer employeeId;
}

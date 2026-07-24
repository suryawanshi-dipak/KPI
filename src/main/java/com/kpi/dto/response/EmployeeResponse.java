package com.kpi.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;
import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class EmployeeResponse {
    private Integer id;
    private String name;
    private String email;
    private String designation;
    private String department;
    private String role;
    private Integer managerId;
    private String employeeId;
    private String phone;
    private LocalDate joinedOn;
    private String gender;
    private String status;
}

package com.kpi.dto.request;

import com.kpi.entity.enums.EmployeeStatus;
import com.kpi.entity.enums.Role;
import lombok.*;

import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmployeeRequest {
    private String employeeId;
    private String email;
    private String name;
    private Role role;
    private String department;
    private String designation;
    private Integer managerId;
    private String phone;
    private LocalDate joinedOn;
    private String gender;
    private EmployeeStatus status;
}

package com.kpi.service;

import com.kpi.dto.response.EmployeeResponse;

import java.util.List;

public interface EmployeeService {

    List<EmployeeResponse> getAll();

    EmployeeResponse getById(Integer id);
}

package com.kpi.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.kpi.entity.Employee;

public interface EmployeeRepository extends JpaRepository<Employee, Integer>{
 
    Optional<Employee> findByEmail(String email);

    Optional<Employee> findByEmployeeId(String employeeId);    
}

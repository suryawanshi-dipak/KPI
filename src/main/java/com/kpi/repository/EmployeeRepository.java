package com.kpi.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.kpi.entity.Employee;

public interface EmployeeRepository extends JpaRepository<Employee, Integer>{

    Optional<Employee> findByEmail(String email);

    Optional<Employee> findByEmployeeId(String employeeId);

    List<Employee> findByManager_Id(Integer managerId);

    // LEFT JOIN FETCH eagerly initializes the lazy `manager` association in this same query, so
    // callers can read employee.getManager() safely after the session/transaction that ran this
    // query has closed (plain findAll() would hand back lazy proxies that blow up with
    // LazyInitializationException once touched outside that session — exactly what
    // NotificationServiceImpl.resolveRecipients needs to do across an async, non-transactional call).
    @Query("SELECT e FROM Employee e LEFT JOIN FETCH e.manager")
    List<Employee> findAllWithManager();
}

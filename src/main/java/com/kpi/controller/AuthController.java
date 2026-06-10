package com.kpi.controller;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kpi.dto.request.LoginRequest;
import com.kpi.dto.response.LoginResponse;
import com.kpi.entity.Employee;
import com.kpi.repository.EmployeeRepository;
import com.kpi.security.JwtService;

import lombok.RequiredArgsConstructor;

import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final EmployeeRepository employeeRepository;
    private final JwtService jwtService;

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(
            @RequestBody LoginRequest request) {

        Authentication authentication =
                authenticationManager.authenticate(
                        new UsernamePasswordAuthenticationToken(
                                request.getEmail(),
                                request.getPassword()
                        )
                );

        Employee employee = employeeRepository
                .findByEmail(request.getEmail())
                .orElseThrow();

        LoginResponse response =
                LoginResponse.builder()
                        .token(jwtService.generateToken(employee.getEmail()))
                        .email(employee.getEmail())
                        .role(employee.getRole().name())
                        .name(employee.getFirstName() + " " + employee.getLastName())
                        .employeeId(employee.getId())
                        .build();

        return ResponseEntity.ok(response);
    }
}

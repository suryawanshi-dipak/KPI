package com.kpi.security;

import java.util.List;

import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import com.kpi.entity.Employee;
import com.kpi.repository.EmployeeRepository;

@Service
public class CustomUserDetailsService implements UserDetailsService{

    private final EmployeeRepository employeeRepository;

    public CustomUserDetailsService(EmployeeRepository employeeRepository) {
        this.employeeRepository = employeeRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        Employee emp = employeeRepository.findByEmail(email).orElseThrow(() -> new UsernameNotFoundException(email));
        
        return User.builder().username(emp.getEmail()).password(emp.getPasswordHash()).authorities(
                        List.of(
                                new SimpleGrantedAuthority(
                                        "ROLE_" + emp.getRole().name().toUpperCase()
                                )
                        )
                )
                .build();
    }
    
}

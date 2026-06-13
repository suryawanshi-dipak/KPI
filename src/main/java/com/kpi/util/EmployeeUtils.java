package com.kpi.util;

import com.kpi.entity.Employee;

public final class EmployeeUtils {

    private EmployeeUtils() {}

    // Fallback chain: firstName+lastName → name → email (Employee table supports both naming conventions)
    public static String resolveName(Employee e) {
        if (e == null) return null;
        if (e.getFirstName() != null) {
            String full = e.getFirstName();
            if (e.getLastName() != null) full += " " + e.getLastName();
            return full;
        }
        return e.getName() != null ? e.getName() : e.getEmail();
    }
}

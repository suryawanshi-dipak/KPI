package com.kpi.entity.enums;

public enum Frequency {

    WEEKLY("weekly"),
    BI_WEEKLY("bi-weekly"),
    MONTHLY("monthly"),
    QUARTERLY("quarterly"),
    PER_RELEASE("per release"),
    PER_COMMIT("per commit");

    private final String value;

    Frequency(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

}

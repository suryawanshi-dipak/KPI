package com.kpi.entity.enums;




public enum Direction {

    HIGHER_BETTER("higher_better"),
    LOWER_BETTER("lower_better"),
    TARGET("target");

    private final String value;

    Direction(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }
}
    

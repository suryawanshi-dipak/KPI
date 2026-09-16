package com.kpi.event;

public class KpiMeasurementCreatedEvent {
    private final Long measurementId;

    public KpiMeasurementCreatedEvent(Long measurementId) {
        this.measurementId = measurementId;
    }

    public Long getMeasurementId() {
        return measurementId;
    }
}

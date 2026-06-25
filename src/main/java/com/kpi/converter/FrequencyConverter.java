package com.kpi.converter;

import com.kpi.entity.enums.Frequency;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class FrequencyConverter implements AttributeConverter<Frequency, String> {

    @Override
    public String convertToDatabaseColumn(Frequency frequency) {
        if (frequency == null) return null;
        return frequency.name();
    }

    @Override
    public Frequency convertToEntityAttribute(String dbValue) {
        if (dbValue == null) return null;
        return Frequency.valueOf(dbValue.replace('-', '_').replace(' ', '_'));
    }
}

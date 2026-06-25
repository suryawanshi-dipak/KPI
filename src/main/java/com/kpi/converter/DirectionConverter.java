package com.kpi.converter;

import com.kpi.entity.enums.Direction;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class DirectionConverter implements AttributeConverter<Direction, String> {

    @Override
    public String convertToDatabaseColumn(Direction direction) {
        if (direction == null) return null;
        return direction.name();
    }

    @Override
    public Direction convertToEntityAttribute(String dbValue) {
        if (dbValue == null) return null;
        return Direction.valueOf(dbValue);
    }
}

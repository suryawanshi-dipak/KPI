package com.kpi.exception;

/** Field-level validation failure for the Proactive Work module, mapped to 422 by
 *  ProactiveWorkExceptionAdvice with the {"field":..., "message":...} shape the BRD specifies. */
public class ProactiveWorkValidationException extends RuntimeException {

    private final String field;

    public ProactiveWorkValidationException(String field, String message) {
        super(message);
        this.field = field;
    }

    public String getField() {
        return field;
    }
}

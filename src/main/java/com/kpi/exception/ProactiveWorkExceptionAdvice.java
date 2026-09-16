package com.kpi.exception;

import com.kpi.controller.ProactiveWorkController;
import com.kpi.dto.response.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Scoped to ProactiveWorkController only (assignableTypes), so this does not change how any
 * other module's MethodArgumentNotValidException/AccessDeniedException is handled — those still
 * fall through to GlobalExceptionHandler / Spring Security's default 403 exactly as before.
 */
@RestControllerAdvice(assignableTypes = ProactiveWorkController.class)
public class ProactiveWorkExceptionAdvice {

    @ExceptionHandler(ProactiveWorkValidationException.class)
    public ResponseEntity<Map<String, String>> handleValidation(ProactiveWorkValidationException ex) {
        Map<String, String> body = new LinkedHashMap<>();
        body.put("field", ex.getField());
        body.put("message", ex.getMessage());
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(body);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiResponse.error(ex.getMessage()));
    }
}

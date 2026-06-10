package com.kpi.controller;

import com.kpi.dto.request.KraAreaRequest;
import com.kpi.dto.response.ApiResponse;
import com.kpi.dto.response.KraAreaResponse;
import com.kpi.service.KraAreaService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/kra-areas")
@RequiredArgsConstructor
public class KraAreaController {

    private final KraAreaService kraAreaService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<KraAreaResponse>>> getAll(
            @RequestParam(defaultValue = "false") boolean activeOnly) {
        return ResponseEntity.ok(ApiResponse.success(kraAreaService.getAll(activeOnly)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<KraAreaResponse>> getById(@PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.success(kraAreaService.getById(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<KraAreaResponse>> create(@Valid @RequestBody KraAreaRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("KRA Area created successfully", kraAreaService.create(request)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<KraAreaResponse>> update(
            @PathVariable Integer id, @Valid @RequestBody KraAreaRequest request) {
        return ResponseEntity.ok(ApiResponse.success("KRA Area updated successfully", kraAreaService.update(id, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Integer id) {
        kraAreaService.delete(id);
        return ResponseEntity.ok(ApiResponse.success("KRA Area deleted successfully", null));
    }
}

package com.kpi.controller;

import com.kpi.dto.request.NotificationPreferenceRequest;
import com.kpi.dto.request.PushSubscriptionRequest;
import com.kpi.dto.response.ApiResponse;
import com.kpi.dto.response.PagedResponse;
import com.kpi.dto.response.NotificationPreferenceResponse;
import com.kpi.dto.response.NotificationResponse;
import com.kpi.entity.Employee;
import com.kpi.repository.EmployeeRepository;
import com.kpi.service.NotificationService;
import com.kpi.service.PushSubscriptionService;
import com.kpi.webpush.VapidConfig;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;
    private final PushSubscriptionService subscriptionService;
    private final EmployeeRepository employeeRepository;
    private final VapidConfig vapidConfig;

    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<NotificationResponse>>> getBellFeed(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Integer employeeId = currentEmployeeId();
        Page<NotificationResponse> feedPage = notificationService.getBellFeed(employeeId, PageRequest.of(page, size));
        PagedResponse<NotificationResponse> response = PagedResponse.<NotificationResponse>builder()
                .content(feedPage.getContent())
                .page(feedPage.getNumber())
                .size(feedPage.getSize())
                .totalElements(feedPage.getTotalElements())
                .totalPages(feedPage.getTotalPages())
                .build();
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<ApiResponse<Map<String, Long>>> getUnreadCount() {
        Integer employeeId = currentEmployeeId();
        long count = notificationService.getUnreadCount(employeeId);
        return ResponseEntity.ok(ApiResponse.success(Map.of("unreadCount", count)));
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<ApiResponse<Void>> markRead(@PathVariable Long id) {
        Integer employeeId = currentEmployeeId();
        notificationService.markRead(id, employeeId);
        return ResponseEntity.ok(ApiResponse.success("Notification marked as read", null));
    }

    @PostMapping("/mark-all-read")
    public ResponseEntity<ApiResponse<Void>> markAllRead() {
        Integer employeeId = currentEmployeeId();
        notificationService.markAllRead(employeeId);
        return ResponseEntity.ok(ApiResponse.success("All notifications marked as read", null));
    }

    @GetMapping("/preferences")
    public ResponseEntity<ApiResponse<NotificationPreferenceResponse>> getPreferences() {
        Integer employeeId = currentEmployeeId();
        return ResponseEntity.ok(ApiResponse.success(notificationService.getPreferences(employeeId)));
    }

    @PutMapping("/preferences")
    public ResponseEntity<ApiResponse<NotificationPreferenceResponse>> updatePreferences(
            @RequestBody NotificationPreferenceRequest request) {
        Integer employeeId = currentEmployeeId();
        return ResponseEntity.ok(ApiResponse.success(notificationService.updatePreferences(employeeId, request)));
    }

    @PostMapping("/preferences/permission-asked")
    public ResponseEntity<ApiResponse<Void>> recordPermissionAsked() {
        Integer employeeId = currentEmployeeId();
        notificationService.recordPermissionAsked(employeeId);
        return ResponseEntity.ok(ApiResponse.success("Permission asked recorded", null));
    }

    @PostMapping("/subscriptions")
    public ResponseEntity<ApiResponse<Void>> subscribe(
            @Valid @RequestBody PushSubscriptionRequest request,
            HttpServletRequest servletRequest) {
        Integer employeeId = currentEmployeeId();
        String userAgent = servletRequest.getHeader("User-Agent");
        subscriptionService.subscribe(employeeId, request, userAgent);
        return ResponseEntity.ok(ApiResponse.success("Push subscription registered", null));
    }

    @DeleteMapping("/subscriptions")
    public ResponseEntity<ApiResponse<Void>> unsubscribe(@RequestParam String endpoint) {
        Integer employeeId = currentEmployeeId();
        subscriptionService.unsubscribe(employeeId, endpoint);
        return ResponseEntity.ok(ApiResponse.success("Push subscription removed", null));
    }

    @GetMapping("/vapid-public-key")
    public ResponseEntity<ApiResponse<Map<String, String>>> getVapidPublicKey() {
        return ResponseEntity.ok(ApiResponse.success(Map.of("publicKey", vapidConfig.publicKeyBase64Url())));
    }

    private Integer currentEmployeeId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new AccessDeniedException("Not authenticated");
        }
        return employeeRepository.findByEmail(auth.getName())
                .map(Employee::getId)
                .orElseThrow(() -> new AccessDeniedException("Current user not found"));
    }
}

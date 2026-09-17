package com.kpi.service.impl;

import com.kpi.dto.request.PushSubscriptionRequest;
import com.kpi.entity.PushSubscription;
import com.kpi.repository.PushSubscriptionRepository;
import com.kpi.service.PushSubscriptionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class PushSubscriptionServiceImpl implements PushSubscriptionService {

    private final PushSubscriptionRepository subscriptionRepository;

    @Override
    @Transactional
    public PushSubscription subscribe(Integer employeeId, PushSubscriptionRequest request, String userAgent) {
        String endpoint = request.getEndpoint().trim();
        Optional<PushSubscription> existing = subscriptionRepository.findByEndpoint(endpoint);

        String effectiveUserAgent = request.getUserAgent() != null ? request.getUserAgent() : userAgent;

        if (existing.isPresent()) {
            PushSubscription sub = existing.get();
            sub.setEmployeeId(employeeId);
            sub.setP256dh(request.getP256dh());
            sub.setAuth(request.getAuth());
            if (effectiveUserAgent != null) {
                sub.setUserAgent(effectiveUserAgent);
            }
            sub.setRevokedAt(null);
            return subscriptionRepository.save(sub);
        }

        PushSubscription newSub = PushSubscription.builder()
                .employeeId(employeeId)
                .endpoint(endpoint)
                .p256dh(request.getP256dh())
                .auth(request.getAuth())
                .userAgent(effectiveUserAgent)
                .build();

        return subscriptionRepository.save(newSub);
    }

    @Override
    @Transactional
    public void unsubscribe(Integer employeeId, String endpoint) {
        subscriptionRepository.findByEndpoint(endpoint).ifPresent(sub -> {
            if (sub.getEmployeeId().equals(employeeId)) {
                sub.setRevokedAt(LocalDateTime.now());
                subscriptionRepository.save(sub);
            }
        });
    }

    @Override
    @Transactional
    public void revoke(String endpoint) {
        subscriptionRepository.findByEndpoint(endpoint).ifPresent(sub -> {
            if (sub.getRevokedAt() == null) {
                sub.setRevokedAt(LocalDateTime.now());
                subscriptionRepository.save(sub);
                log.info("Revoked push subscription for endpoint {} (404/410 Gone)", endpoint);
            }
        });
    }

    @Override
    @Transactional
    public void markSuccess(String endpoint) {
        subscriptionRepository.findByEndpoint(endpoint).ifPresent(sub -> {
            sub.setLastSuccessAt(LocalDateTime.now());
            subscriptionRepository.save(sub);
        });
    }

    @Override
    @Transactional(readOnly = true)
    public List<PushSubscription> getActiveSubscriptions(Integer employeeId) {
        return subscriptionRepository.findByEmployeeIdAndRevokedAtIsNull(employeeId);
    }
}

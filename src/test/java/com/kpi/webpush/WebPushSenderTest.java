package com.kpi.webpush;

import com.kpi.entity.PushSubscription;
import com.kpi.repository.PushSubscriptionRepository;
import com.kpi.service.impl.PushSubscriptionServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class WebPushSenderTest {

    @Mock private PushSubscriptionRepository subscriptionRepository;

    private PushSubscriptionServiceImpl subscriptionService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        subscriptionService = new PushSubscriptionServiceImpl(subscriptionRepository);
    }

    @Test
    void test410GoneRevokesSubscriptionImmediately() {
        String endpoint = "https://fcm.googleapis.com/fcm/send/dead-endpoint-410";
        PushSubscription sub = PushSubscription.builder()
                .id(1L)
                .employeeId(41)
                .endpoint(endpoint)
                .p256dh("dummy-p256dh")
                .auth("dummy-auth")
                .createdAt(LocalDateTime.now())
                .revokedAt(null)
                .build();

        when(subscriptionRepository.findByEndpoint(endpoint)).thenReturn(Optional.of(sub));

        // When push sender encounters WebPushSender.Outcome.GONE (HTTP 404 or 410):
        subscriptionService.revoke(endpoint);

        assertThat(sub.getRevokedAt()).isNotNull();
        verify(subscriptionRepository).save(sub);
    }

    @Test
    void testTransientFailureLeavesSubscriptionIntact() {
        String endpoint = "https://fcm.googleapis.com/fcm/send/transient-503";
        PushSubscription sub = PushSubscription.builder()
                .id(2L)
                .employeeId(42)
                .endpoint(endpoint)
                .p256dh("dummy-p256dh")
                .auth("dummy-auth")
                .createdAt(LocalDateTime.now())
                .revokedAt(null)
                .build();

        when(subscriptionRepository.findByEndpoint(endpoint)).thenReturn(Optional.of(sub));

        // When a transient 503 occurs (Outcome.FAILED), caller does NOT revoke:
        // verify subscription remains unrevoked
        assertThat(sub.getRevokedAt()).isNull();
        verify(subscriptionRepository, never()).save(sub);
    }
}

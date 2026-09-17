package com.kpi.webpush;

import com.kpi.entity.PushSubscription;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * Sends one already-formatted notification body to one browser subscription. Never batches:
 * each subscription needs its own encryption (the shared secret is per-subscriber), so the
 * caller ({@code NotificationService}) loops over recipients and calls this once per subscription.
 */
@Component
@Slf4j
public class WebPushSender {

    /** Non-GONE failures get this many total attempts (first try + retries) before we give up on this send. */
    private static final int MAX_ATTEMPTS = 3;
    private static final Duration TTL = Duration.ofDays(1);

    public enum Outcome {
        /** Push service accepted the message. */
        SUCCESS,
        /** Push service says this subscription no longer exists (404/410) — caller must revoke it, never retry. */
        GONE,
        /** Every attempt failed for a transient reason (network error, 5xx, rate limit) — caller leaves the row pending for the next digest sweep. */
        FAILED
    }

    private final VapidJwtSigner jwtSigner;
    private final WebPushEncryptor encryptor = new WebPushEncryptor();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public WebPushSender(VapidJwtSigner jwtSigner) {
        this.jwtSigner = jwtSigner;
    }

    public Outcome send(PushSubscription subscription, String jsonPayload) {
        byte[] body;
        HttpRequest request;
        try {
            body = encryptor.encrypt(
                    EcKeyUtils.base64UrlDecode(subscription.getP256dh()),
                    EcKeyUtils.base64UrlDecode(subscription.getAuth()),
                    jsonPayload.getBytes(StandardCharsets.UTF_8));

            URI endpoint = URI.create(subscription.getEndpoint());
            String origin = endpoint.getScheme() + "://" + endpoint.getHost()
                    + (endpoint.getPort() != -1 ? ":" + endpoint.getPort() : "");

            request = HttpRequest.newBuilder()
                    .uri(endpoint)
                    .header("Content-Type", "application/octet-stream")
                    .header("Content-Encoding", "aes128gcm")
                    .header("TTL", String.valueOf(TTL.toSeconds()))
                    .header("Authorization", jwtSigner.buildAuthorizationHeader(origin))
                    .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                    .build();
        } catch (RuntimeException e) {
            log.warn("Could not build push request for subscription {}: {}", subscription.getId(), e.toString());
            return Outcome.FAILED;
        }

        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                HttpResponse<Void> response = httpClient.send(request, HttpResponse.BodyHandlers.discarding());
                int status = response.statusCode();
                if (status == 200 || status == 201 || status == 204) {
                    return Outcome.SUCCESS;
                }
                if (status == 404 || status == 410) {
                    return Outcome.GONE;
                }
                log.warn("Push service returned {} for subscription {} (attempt {}/{})",
                        status, subscription.getId(), attempt, MAX_ATTEMPTS);
            } catch (java.io.IOException | InterruptedException e) {
                if (e instanceof InterruptedException) Thread.currentThread().interrupt();
                log.warn("Push send failed for subscription {} (attempt {}/{}): {}",
                        subscription.getId(), attempt, MAX_ATTEMPTS, e.toString());
            }
            if (attempt < MAX_ATTEMPTS) {
                sleepBackoff(attempt);
            }
        }
        return Outcome.FAILED;
    }

    private void sleepBackoff(int attempt) {
        try {
            Thread.sleep(200L * (1L << (attempt - 1)));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}

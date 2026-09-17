package com.kpi.webpush;

import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;

/**
 * Loads the application's single VAPID keypair (see application.yaml {@code webpush.vapid.*})
 * and fails application startup outright if it is missing or malformed — every push send needs
 * it, so there is no useful degraded mode to fall back to. Generate a keypair with:
 * {@code openssl ecparam -genkey -name prime256v1 -noout} then re-encode the raw point/scalar
 * as unpadded base64url (see this class's own tests for the exact byte layout expected).
 */
@Configuration
@ConfigurationProperties(prefix = "webpush.vapid")
@Getter
@Setter
public class VapidConfig {

    /** Base64url, unpadded, 65-byte uncompressed P-256 point (RFC 8292 applicationServerKey). */
    private String publicKey;

    /** Base64url, unpadded, 32-byte P-256 private scalar. Never logged, never returned by any endpoint. */
    private String privateKey;

    /** VAPID JWT "sub" claim, e.g. mailto:ops@example.com — required by the push services so they can contact the sender. */
    private String subject;

    @Getter(lombok.AccessLevel.NONE)
    private ECPublicKey publicKeyEc;
    @Getter(lombok.AccessLevel.NONE)
    private ECPrivateKey privateKeyEc;

    @PostConstruct
    void validateAndDecode() {
        if (!StringUtils.hasText(publicKey) || !StringUtils.hasText(privateKey) || !StringUtils.hasText(subject)) {
            throw new IllegalStateException(
                    "webpush.vapid.public-key / private-key / subject must all be configured — " +
                    "push notifications cannot function without a VAPID keypair. " +
                    "Generate one with: openssl ecparam -genkey -name prime256v1 -noout");
        }
        try {
            this.publicKeyEc = EcKeyUtils.publicKeyFromUncompressed(EcKeyUtils.base64UrlDecode(publicKey));
            this.privateKeyEc = EcKeyUtils.privateKeyFromScalar(EcKeyUtils.base64UrlDecode(privateKey));
        } catch (RuntimeException e) {
            throw new IllegalStateException("webpush.vapid.public-key/private-key are not valid P-256 key material", e);
        }
    }

    public ECPublicKey publicKeyEc() {
        return publicKeyEc;
    }

    public ECPrivateKey privateKeyEc() {
        return privateKeyEc;
    }

    /** The exact string the frontend's PushManager.subscribe() call needs as applicationServerKey. */
    public String publicKeyBase64Url() {
        return publicKey;
    }
}

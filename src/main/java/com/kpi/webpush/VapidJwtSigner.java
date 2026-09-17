package com.kpi.webpush;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.security.GeneralSecurityException;
import java.security.Signature;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Builds the RFC 8292 VAPID Authorization header: an ES256-signed JWT asserting who is sending
 * this push, scoped to the target push service's own origin (not the full subscription
 * endpoint — browsers reject a token whose "aud" doesn't match their push service's origin).
 */
@Component
public class VapidJwtSigner {

    private static final long EXPIRY_SECONDS = 12 * 3600;
    private static final ObjectMapper JSON = new ObjectMapper();

    private final VapidConfig vapidConfig;

    public VapidJwtSigner(VapidConfig vapidConfig) {
        this.vapidConfig = vapidConfig;
    }

    /** @param pushServiceOrigin scheme+host(+port) of the subscription endpoint, e.g. https://fcm.googleapis.com */
    public String buildAuthorizationHeader(String pushServiceOrigin) {
        try {
            String header = base64UrlJson(Map.of("typ", "JWT", "alg", "ES256"));

            Map<String, Object> claims = new LinkedHashMap<>();
            claims.put("aud", pushServiceOrigin);
            claims.put("exp", Instant.now().getEpochSecond() + EXPIRY_SECONDS);
            claims.put("sub", vapidConfig.getSubject());
            String payload = base64UrlJson(claims);

            String signingInput = header + "." + payload;

            Signature signature = Signature.getInstance("SHA256withECDSA");
            signature.initSign(vapidConfig.privateKeyEc());
            signature.update(signingInput.getBytes(java.nio.charset.StandardCharsets.US_ASCII));
            byte[] derSignature = signature.sign();
            byte[] joseSignature = derToJose(derSignature, 32);

            String jwt = signingInput + "." + EcKeyUtils.base64UrlEncode(joseSignature);
            return "vapid t=" + jwt + ", k=" + vapidConfig.publicKeyBase64Url();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Failed to sign VAPID JWT", e);
        }
    }

    private String base64UrlJson(Map<String, ?> value) {
        try {
            return EcKeyUtils.base64UrlEncode(JSON.writeValueAsBytes(value));
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    /**
     * JOSE (used by ES256 JWTs) wants a fixed-width raw {@code r || s} signature; JCA's
     * SHA256withECDSA always produces a DER SEQUENCE of two variable-length INTEGERs. This
     * walks that SEQUENCE and repacks each integer into exactly {@code fieldSize} bytes,
     * stripping any DER sign-padding byte or left-padding with zero as needed.
     */
    static byte[] derToJose(byte[] der, int fieldSize) {
        if (der[0] != 0x30) {
            throw new IllegalArgumentException("Not a DER SEQUENCE");
        }
        int[] cursor = {2};
        if ((der[1] & 0x80) != 0) {
            cursor[0] = 2 + (der[1] & 0x7f);
        }
        byte[] r = readDerInteger(der, cursor);
        byte[] s = readDerInteger(der, cursor);
        byte[] out = new byte[fieldSize * 2];
        System.arraycopy(EcKeyUtils.toFixedLength(r, fieldSize), 0, out, 0, fieldSize);
        System.arraycopy(EcKeyUtils.toFixedLength(s, fieldSize), 0, out, fieldSize, fieldSize);
        return out;
    }

    private static byte[] readDerInteger(byte[] der, int[] cursor) {
        int pos = cursor[0];
        if (der[pos] != 0x02) {
            throw new IllegalArgumentException("Expected DER INTEGER tag");
        }
        pos++;
        int len = der[pos] & 0xff;
        pos++;
        if ((len & 0x80) != 0) {
            int lenBytes = len & 0x7f;
            len = 0;
            for (int i = 0; i < lenBytes; i++) {
                len = (len << 8) | (der[pos++] & 0xff);
            }
        }
        byte[] value = new byte[len];
        System.arraycopy(der, pos, value, 0, len);
        cursor[0] = pos + len;
        return value;
    }
}

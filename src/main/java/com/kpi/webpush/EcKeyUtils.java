package com.kpi.webpush;

import java.security.*;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.*;
import java.util.Base64;

/**
 * Raw-bytes &lt;-&gt; JCA key conversion for P-256, shared by VAPID (our own keypair) and Web
 * Push payload encryption (the browser's per-subscription {@code p256dh} key). Everything in
 * this feature speaks the "uncompressed point" (65 bytes, leading 0x04) / "raw scalar" (32
 * bytes) wire formats from RFC 8291/8292, never PEM or DER, so this is the one place that
 * bridges to {@link KeyFactory}.
 */
final class EcKeyUtils {

    static final String CURVE_NAME = "secp256r1";
    private static final ECParameterSpec P256_PARAMS = loadP256Params();

    private EcKeyUtils() {
    }

    private static ECParameterSpec loadP256Params() {
        try {
            AlgorithmParameters params = AlgorithmParameters.getInstance("EC");
            params.init(new ECGenParameterSpec(CURVE_NAME));
            return params.getParameterSpec(ECParameterSpec.class);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("JVM has no P-256 EC support", e);
        }
    }

    static ECPublicKey publicKeyFromUncompressed(byte[] uncompressed) {
        if (uncompressed.length != 65 || uncompressed[0] != 0x04) {
            throw new IllegalArgumentException("Expected a 65-byte uncompressed EC point starting with 0x04");
        }
        byte[] x = new byte[32];
        byte[] y = new byte[32];
        System.arraycopy(uncompressed, 1, x, 0, 32);
        System.arraycopy(uncompressed, 33, y, 0, 32);
        ECPoint point = new ECPoint(new java.math.BigInteger(1, x), new java.math.BigInteger(1, y));
        try {
            KeyFactory kf = KeyFactory.getInstance("EC");
            return (ECPublicKey) kf.generatePublic(new ECPublicKeySpec(point, P256_PARAMS));
        } catch (GeneralSecurityException e) {
            throw new IllegalArgumentException("Malformed EC public key bytes", e);
        }
    }

    static ECPrivateKey privateKeyFromScalar(byte[] scalar) {
        if (scalar.length != 32) {
            throw new IllegalArgumentException("Expected a 32-byte EC private scalar");
        }
        try {
            KeyFactory kf = KeyFactory.getInstance("EC");
            return (ECPrivateKey) kf.generatePrivate(
                    new ECPrivateKeySpec(new java.math.BigInteger(1, scalar), P256_PARAMS));
        } catch (GeneralSecurityException e) {
            throw new IllegalArgumentException("Malformed EC private key bytes", e);
        }
    }

    static byte[] publicKeyToUncompressed(ECPublicKey key) {
        byte[] x = toFixedLength(key.getW().getAffineX().toByteArray(), 32);
        byte[] y = toFixedLength(key.getW().getAffineY().toByteArray(), 32);
        byte[] out = new byte[65];
        out[0] = 0x04;
        System.arraycopy(x, 0, out, 1, 32);
        System.arraycopy(y, 0, out, 33, 32);
        return out;
    }

    /** BigInteger.toByteArray() may prepend a sign byte or be short a leading zero; normalize to exactly {@code len} bytes. */
    static byte[] toFixedLength(byte[] bytes, int len) {
        if (bytes.length == len) return bytes;
        byte[] out = new byte[len];
        if (bytes.length > len) {
            System.arraycopy(bytes, bytes.length - len, out, 0, len);
        } else {
            System.arraycopy(bytes, 0, out, len - bytes.length, bytes.length);
        }
        return out;
    }

    static KeyPair generateEphemeralKeyPair() {
        try {
            KeyPairGenerator kpg = KeyPairGenerator.getInstance("EC");
            kpg.initialize(new ECGenParameterSpec(CURVE_NAME));
            return kpg.generateKeyPair();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("JVM cannot generate an EC keypair", e);
        }
    }

    static byte[] base64UrlDecode(String s) {
        return Base64.getUrlDecoder().decode(s);
    }

    static String base64UrlEncode(byte[] b) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }
}

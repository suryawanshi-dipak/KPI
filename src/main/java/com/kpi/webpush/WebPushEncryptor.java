package com.kpi.webpush;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyPair;
import java.security.SecureRandom;
import java.security.interfaces.ECPublicKey;
import java.util.Arrays;

/**
 * Encrypts a push payload per RFC 8291 (aes128gcm content-coding, RFC 8188) so only the
 * subscribing browser — which alone holds the private half of {@code p256dh} — can read it.
 * Single-record messages only (our payloads are a few hundred bytes of JSON, nowhere near the
 * 4096-byte record-size ceiling used here), so there is no multi-record padding/chunking logic.
 */
class WebPushEncryptor {

    private static final int RECORD_SIZE = 4096;
    private static final byte DELIMITER_LAST_RECORD = 0x02;
    private static final byte[] INFO_PREFIX = "WebPush: info\0".getBytes(StandardCharsets.US_ASCII);
    private static final byte[] CEK_INFO = "Content-Encoding: aes128gcm\0".getBytes(StandardCharsets.US_ASCII);
    private static final byte[] NONCE_INFO = "Content-Encoding: nonce\0".getBytes(StandardCharsets.US_ASCII);

    private final SecureRandom random = new SecureRandom();

    /**
     * @param p256dh     the subscription's public key, raw uncompressed point (65 bytes)
     * @param authSecret the subscription's auth secret (16 bytes)
     * @param plaintext  the JSON payload to deliver
     * @return the exact HTTPS request body for the push service, per the wire format in this class's header comment
     */
    byte[] encrypt(byte[] p256dh, byte[] authSecret, byte[] plaintext) {
        try {
            ECPublicKey uaPublicKey = EcKeyUtils.publicKeyFromUncompressed(p256dh);
            KeyPair ephemeral = EcKeyUtils.generateEphemeralKeyPair();
            byte[] asPublicBytes = EcKeyUtils.publicKeyToUncompressed((ECPublicKey) ephemeral.getPublic());

            KeyAgreement ka = KeyAgreement.getInstance("ECDH");
            ka.init(ephemeral.getPrivate());
            ka.doPhase(uaPublicKey, true);
            byte[] sharedSecret = ka.generateSecret();

            byte[] prkKey = hkdfExtract(authSecret, sharedSecret);
            byte[] keyInfo = concat(INFO_PREFIX, p256dh, asPublicBytes);
            byte[] ikm = hkdfExpand(prkKey, keyInfo, 32);

            byte[] salt = new byte[16];
            random.nextBytes(salt);
            byte[] prkContent = hkdfExtract(salt, ikm);
            byte[] cek = hkdfExpand(prkContent, CEK_INFO, 16);
            byte[] nonce = hkdfExpand(prkContent, NONCE_INFO, 12);

            byte[] record = new byte[plaintext.length + 1];
            System.arraycopy(plaintext, 0, record, 0, plaintext.length);
            record[plaintext.length] = DELIMITER_LAST_RECORD;

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(cek, "AES"), new GCMParameterSpec(128, nonce));
            byte[] ciphertext = cipher.doFinal(record);

            if (ciphertext.length > RECORD_SIZE) {
                throw new IllegalStateException("Push payload too large for a single aes128gcm record: " + ciphertext.length + " bytes");
            }

            ByteArrayOutputStream header = new ByteArrayOutputStream();
            header.write(salt, 0, salt.length);
            header.write((RECORD_SIZE >>> 24) & 0xff);
            header.write((RECORD_SIZE >>> 16) & 0xff);
            header.write((RECORD_SIZE >>> 8) & 0xff);
            header.write(RECORD_SIZE & 0xff);
            header.write(asPublicBytes.length);
            header.write(asPublicBytes, 0, asPublicBytes.length);
            header.write(ciphertext, 0, ciphertext.length);
            return header.toByteArray();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Web Push encryption failed", e);
        }
    }

    private static byte[] hkdfExtract(byte[] salt, byte[] ikm) throws GeneralSecurityException {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(salt, "HmacSHA256"));
        return mac.doFinal(ikm);
    }

    private static byte[] hkdfExpand(byte[] prk, byte[] info, int length) throws GeneralSecurityException {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(prk, "HmacSHA256"));
        mac.update(info);
        mac.update((byte) 1);
        return Arrays.copyOf(mac.doFinal(), length);
    }

    private static byte[] concat(byte[]... parts) {
        int total = 0;
        for (byte[] p : parts) total += p.length;
        byte[] out = new byte[total];
        int offset = 0;
        for (byte[] p : parts) {
            System.arraycopy(p, 0, out, offset, p.length);
            offset += p.length;
        }
        return out;
    }
}

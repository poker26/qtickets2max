import { SignJWT, jwtVerify } from "jose";

import { gigachatMcpConfiguration } from "../config.js";
import { SberCommerceError, SberCommerceErrorCodes } from "./error-codes.js";

function getSigningSecretBytes() {
  const rawSecret = gigachatMcpConfiguration.sber.mandateSigningSecret;
  if (!rawSecret || rawSecret.length < 16) {
    throw new SberCommerceError(
      SberCommerceErrorCodes.INTERNAL_SERVER_ERROR,
      "SBER_MANDATE_SIGNING_SECRET is missing or too short (min 16 characters)"
    );
  }
  return new TextEncoder().encode(rawSecret);
}

/**
 * Подпись мерчанта для CartMandate (HS256 JWT полезной нагрузки).
 * Для продакшена при требовании RS256 со стороны Сбера — заменить алгоритм и ключи по их инструкции.
 *
 * @param {Record<string, unknown>} claims
 */
export async function signMerchantMandateJwt(claims) {
  const secretKey = getSigningSecretBytes();
  const jwt = await new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(gigachatMcpConfiguration.sber.mandateJwtExpiresIn)
    .sign(secretKey);
  return jwt;
}

/**
 * @param {string} jwtToken
 * @param {Record<string, unknown>} expectedClaims
 */
export async function verifyMerchantMandateJwt(jwtToken, expectedClaims) {
  try {
    const secretKey = getSigningSecretBytes();
    const { payload } = await jwtVerify(jwtToken, secretKey, { algorithms: ["HS256"] });
    for (const [key, value] of Object.entries(expectedClaims)) {
      if (payload[key] !== value) {
        throw new SberCommerceError(SberCommerceErrorCodes.INVALID_MANDATE_SIGNATURE);
      }
    }
  } catch (error) {
    if (error instanceof SberCommerceError) {
      throw error;
    }
    throw new SberCommerceError(SberCommerceErrorCodes.INVALID_MANDATE_SIGNATURE);
  }
}

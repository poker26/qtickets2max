import { z } from "zod";

import { gigachatMcpConfiguration } from "../config.js";
import { SberCommerceError, SberCommerceErrorCodes } from "./error-codes.js";

/** RFC 4122 UUID v4 (строго, как требует спецификация Сбера для rqUid). */
export const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertValidRqUid(rqUid) {
  if (typeof rqUid !== "string" || !UUID_V4_REGEX.test(rqUid)) {
    throw new SberCommerceError(
      SberCommerceErrorCodes.INTERNAL_SERVER_ERROR,
      "rqUid must be a UUID v4 string"
    );
  }
}

export const clientInfoSchema = z.object({
  clientInfoToken: z.string(),
  sberId: z.string(),
  accessToken: z.string(),
});

/**
 * @param {unknown} clientInfo
 */
export function parseAndAssertClientInfo(clientInfo) {
  const relax = gigachatMcpConfiguration.sber.relaxClientInfoValidation;
  if (relax) {
    const loose = z
      .object({
        clientInfoToken: z.string().optional().default(""),
        sberId: z.string().optional().default(""),
        accessToken: z.string().optional().default(""),
      })
      .safeParse(clientInfo);
    if (!loose.success) {
      throw new SberCommerceError(SberCommerceErrorCodes.INVALID_CLIENT_INFO_TOKEN);
    }
    return loose.data;
  }

  const strict = clientInfoSchema.safeParse(clientInfo);
  if (!strict.success) {
    throw new SberCommerceError(SberCommerceErrorCodes.INVALID_CLIENT_INFO_TOKEN);
  }
  return strict.data;
}

/**
 * @param {string} [token]
 */
export function assertClientInfoTokenPlausible(token) {
  if (!gigachatMcpConfiguration.sber.verifyClientInfoJwt) {
    return;
  }
  if (!token || typeof token !== "string" || token.split(".").length !== 3) {
    throw new SberCommerceError(SberCommerceErrorCodes.INVALID_CLIENT_INFO_TOKEN);
  }
}

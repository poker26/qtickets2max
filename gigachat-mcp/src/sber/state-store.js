/**
 * In-memory хранилище мандатов и заказов (для соответствия сценарию Сбера до подключения внешней БД).
 */

export function createCommerceStateStore() {
  /** @type {Map<string, { merchantSignedMandate: unknown, createdAt: string }>} */
  const merchantMandatesById = new Map();

  /** @type {Map<string, { fullySignedMandate: unknown, storedAt: string }>} */
  const fullySignedByMandateId = new Map();

  /** @type {Map<string, unknown>} */
  const ordersById = new Map();

  return {
    /**
     * @param {string} mandateId
     * @param {unknown} merchantSignedMandate
     */
    saveMerchantSignedMandate(mandateId, merchantSignedMandate) {
      merchantMandatesById.set(mandateId, {
        merchantSignedMandate,
        createdAt: new Date().toISOString(),
      });
    },

    /**
     * @param {string} mandateId
     */
    getMerchantSignedMandate(mandateId) {
      return merchantMandatesById.get(mandateId) ?? null;
    },

    /**
     * @param {string} mandateId
     * @param {unknown} fullySignedMandate
     */
    saveFullySignedMandate(mandateId, fullySignedMandate) {
      fullySignedByMandateId.set(mandateId, {
        fullySignedMandate,
        storedAt: new Date().toISOString(),
      });
    },

    /**
     * @param {string} mandateId
     */
    getFullySignedMandate(mandateId) {
      return fullySignedByMandateId.get(mandateId) ?? null;
    },

    /**
     * @param {string} orderId
     * @param {unknown} orderRecord
     */
    saveOrder(orderId, orderRecord) {
      ordersById.set(orderId, orderRecord);
    },

    /**
     * @param {string} orderId
     */
    getOrder(orderId) {
      return ordersById.get(orderId) ?? null;
    },
  };
}

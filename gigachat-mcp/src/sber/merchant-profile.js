import { gigachatMcpConfiguration } from "../config.js";

function parseJsonArray(rawValue, fallbackArray) {
  if (!rawValue || !String(rawValue).trim()) {
    return fallbackArray;
  }
  try {
    const parsedValue = JSON.parse(String(rawValue));
    return Array.isArray(parsedValue) ? parsedValue : fallbackArray;
  } catch {
    return String(rawValue)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

function parseJsonObject(rawValue, fallbackObject) {
  if (!rawValue || !String(rawValue).trim()) {
    return fallbackObject;
  }
  try {
    const parsedValue = JSON.parse(String(rawValue));
    return parsedValue && typeof parsedValue === "object" ? parsedValue : fallbackObject;
  } catch {
    return fallbackObject;
  }
}

/**
 * merchantInfo по примеру из mcp-integration; значения — из окружения (SBER_*).
 */
export function buildMerchantInfoPayload() {
  const { sber } = gigachatMcpConfiguration;

  const paymentOptions = parseJsonObject(sber.paymentOptionsJson, {
    online: {
      supported: true,
      methods: ["card", "sberpay"],
    },
    courier: {
      supported: false,
      methods: [],
    },
    pickup: {
      supported: false,
      methods: [],
    },
  });

  const deliveryMethods = parseJsonArray(sber.deliveryMethodsJson, null);
  const defaultDigitalDelivery = [
    {
      type: "electronic_ticket",
      name: "Электронный билет (e-mail)",
      minDays: 0,
      maxDays: 0,
      costTable: [
        {
          orderAmountMin: 0,
          orderAmountMax: Number.MAX_SAFE_INTEGER,
          deliveryCost: 0,
        },
      ],
      costNotes: "Билеты отправляются на электронную почту после оплаты",
    },
  ];

  return {
    merchantName: sber.merchantName,
    website: sber.merchantWebsite,
    description: sber.merchantDescription,
    mainCategories: parseJsonArray(sber.mainCategories, ["excursions", "tickets"]),
    allCategories: parseJsonArray(sber.allCategories, ["excursions", "tickets", "events"]),
    supportedBrands: parseJsonArray(sber.supportedBrands, []),
    deliveryRegions: parseJsonArray(sber.deliveryRegions, ["Россия"]),
    deliveryMethods: deliveryMethods ?? defaultDigitalDelivery,
    paymentOptions,
    sberIntegrations: {
      sberIdSupported: sber.sberIdSupported,
      sberpaySupported: sber.sberpaySupported,
      sberPrimeSupported: sber.sberPrimeSupported,
      sberLoyaltySupported: sber.sberLoyaltySupported,
    },
    contactInfo: {
      phone: sber.contactPhone,
      email: sber.contactEmail,
    },
    additionalInfo: parseJsonObject(sber.additionalInfoJson, {
      digitalDeliveryOnly: true,
    }),
  };
}

export function buildMatchReasons() {
  const { sber } = gigachatMcpConfiguration;
  if (!sber.matchReasons.trim()) {
    return ["экскурсии_и_билеты", "поддержка_sberpay"];
  }
  return sber.matchReasons.split(",").map((item) => item.trim()).filter(Boolean);
}

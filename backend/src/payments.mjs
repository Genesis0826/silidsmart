// Proposed online-payment policy. Quotes never create a bill, payment or revenue.
export const PAYMENT_POLICY = Object.freeze({
  version: 'commission-pilot-2026-11-20', monthlyFeePhp: 0,
  monthlyRentPercent: 3, shortStayPercent: 5, shortStayMaxNights: 29,
  utilitiesPercent: 0, cashPercent: 0, checkoutEnabled: false,
});

export function paymentReadiness(env = process.env) {
  const testCredentialsConfigured = typeof env.PAYMONGO_SECRET_KEY === 'string'
    && /^sk_test_[A-Za-z0-9]+$/.test(env.PAYMONGO_SECRET_KEY);
  return {
    mode: 'Preparation only', checkoutEnabled: false, testCredentialsConfigured,
    provider: 'PayMongo', splitPayments: 'Not integrated',
    message: 'Live online checkout is unavailable. Tenant Billing has a separately gated sandbox checkout; test payments do not settle actual rent. Approved owner routing and provider acceptance remain required for real payments.',
    holdsAndRefunds: 'Not implemented or guaranteed', policy: PAYMENT_POLICY,
  };
}

export function quoteProposedPayment(input, ValidationError) {
  const invalid = (message) => { throw new ValidationError('INVALID_PAYMENT_QUOTE', message); };
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('A payment quote must be a JSON object.');
  const { kind, channel, rentPhp, nights } = input;
  if (!['Monthly rent', 'Short stay', 'Utilities'].includes(kind) || !['Planned online checkout', 'Cash or external transfer'].includes(channel)) {
    invalid('Choose a payment type and either planned online checkout or cash/external transfer.');
  }
  const cents = Math.round(rentPhp * 100);
  if (typeof rentPhp !== 'number' || !Number.isFinite(rentPhp) || rentPhp <= 0 || rentPhp > 10_000_000 || Math.abs(cents-rentPhp*100) > .000001) {
    invalid('Use a positive amount with at most two decimal places, up to ₱10,000,000.');
  }
  if (kind === 'Short stay' && (!Number.isInteger(nights) || nights < 1 || nights > PAYMENT_POLICY.shortStayMaxNights)) {
    invalid('The proposed short-stay rate covers 1–29 nights. Use monthly rent for a longer stay.');
  }
  const percent = channel === 'Cash or external transfer' || kind === 'Utilities' ? 0
    : kind === 'Monthly rent' ? PAYMENT_POLICY.monthlyRentPercent : PAYMENT_POLICY.shortStayPercent;
  return { hypothetical: true, chargedPhp: 0, rentPhp, percent,
    proposedCommissionPhp: Math.round(cents * percent / 100) / 100,
    message: 'Illustration only. Nothing is charged or deducted. Use accommodation rent only; exclude deposits, utilities, taxes and other charges. Provider processing, VAT and platform fees need a confirmed quote.',
  };
}

// Provider adapter prepared against PayMongo Hosted Checkout v2 documentation.
// Tenant statements use this in test mode only. Live owner routing is not enabled.
export function createPayMongoSandboxAdapter({ secretKey, fetchImpl = fetch }) {
  if (typeof secretKey !== 'string' || !/^sk_test_[A-Za-z0-9]+$/.test(secretKey)) throw new Error('A PayMongo test-mode secret key is required. Live keys are not accepted.');
  const request = async (route, options = {}) => {
    const response = await fetchImpl(`https://api.paymongo.com${route}`, {
      ...options, signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`, 'Content-Type': 'application/json', ...options.headers },
    });
    if (!response.ok) throw new Error('PayMongo sandbox request failed. No real payment was recorded.');
    const data = (await response.json()).data;
    if (!/^cs_[A-Za-z0-9_-]+$/.test(data?.id || '') || data.type !== 'checkout_session' || !data.attributes || data.attributes.livemode === true) throw new Error('Invalid sandbox checkout response.');
    return data;
  };
  const sessionPath = id => {
    if (typeof id !== 'string' || !/^cs_[A-Za-z0-9_-]{1,120}$/.test(id)) throw new Error('Invalid checkout session identity.');
    return `/v1/checkout_sessions/${id}`;
  };
  return {
    async createTestSession({ reference, lineItems, successUrl, cancelUrl }) {
      if (typeof reference !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(reference)
        || !Array.isArray(lineItems) || !lineItems.length || lineItems.length > 20
        || lineItems.some(i => typeof i.name !== 'string' || !i.name.trim() || i.name.length > 120 || !Number.isSafeInteger(i.amount) || i.amount < 1 || i.amount > 1_000_000_000)) throw new Error('Invalid sandbox checkout details. Amounts must be integer PHP centavos.');
      for (const url of [successUrl,cancelUrl]) {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost','127.0.0.1'].includes(parsed.hostname))) throw new Error('Use HTTPS return URLs or a local sandbox URL.');
      }
      const data = await request('/v2/checkout_sessions', {
        method: 'POST', headers: { 'Idempotency-Key': reference },
        body: JSON.stringify({ data: { attributes: { reference_number: reference,
          line_items: lineItems.map(i => ({ name: i.name, amount: i.amount, currency: 'PHP', quantity: 1 })),
          payment_method_types: ['qrph'], success_url: successUrl, cancel_url: cancelUrl,
        } } }),
      });
      if (!data?.id || data.attributes?.livemode !== false || new URL(data.attributes.checkout_url).origin !== 'https://checkout.paymongo.com') throw new Error('PayMongo did not return a valid test-mode checkout.');
      return { id: data.id, checkoutUrl: data.attributes.checkout_url, mode: 'test', paid: false };
    },
    retrieveTestSession(id) { return request(sessionPath(id), { method: 'GET' }); },
    expireTestSession(id) { return request(`${sessionPath(id)}/expire`, { method: 'POST' }); },
  };
}

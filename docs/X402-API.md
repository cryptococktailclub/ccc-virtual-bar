# CCC x402 Cocktail Intelligence API

This endpoint sells one grounded cocktail lookup or recommendation per successful x402 payment. It wraps the existing CCC Bar Bot and its bundled 452-recipe JSON, so the public contract and the current human-facing experience use the same recipe engine.

## Contract

- Status: `GET https://cryptococktail.club/api/x402`
- Paid operation: `POST https://cryptococktail.club/api/x402/bartender`
- Payment scheme: x402 v2 `exact`
- Default asset/network: USDC on Base Sepolia (`eip155:84532`)
- Default price: `$0.02` per successfully settled request
- Grounding: database-only; no original riffs
- Discovery: Bazaar input and output schemas are included in the `Payment-Required` response

An unpaid request receives HTTP `402` and x402 payment requirements. A compatible client signs the selected requirement and retries with `Payment-Signature`. The facilitator verifies the authorization before CCC runs the bartender and settles it only when the handler returns a successful response.

## Request

Named recipe lookup:

```json
{
  "mode": "chat",
  "question": "Left Hand Cocktail spec"
}
```

Deterministic recommendation:

```json
{
  "mode": "wizard",
  "wizard_preferences": {
    "style": "spirit_forward",
    "ice": "on_ice",
    "spirits": ["rye_whiskey"]
  },
  "wizard_index": 0,
  "exclude": [],
  "session_id": "agent-session-123"
}
```

The paid request is limited to 8 KiB. Chat questions are limited to 500 characters. Wizard arrays and indexes are bounded to prevent abuse and accidental high-cost calls.

## Successful response

```json
{
  "service": "ccc-cocktail-intelligence",
  "version": "1.0.0",
  "request_id": "e13fb611-3b25-46a6-b063-745d7f1de3bb",
  "grounding": {
    "policy": "dataset_only",
    "recipe_count": 452,
    "no_original_riffs": true
  },
  "structured": {
    "summary": "Milk & Honey spec for Left Hand Cocktail.",
    "warnings": [],
    "recipes": []
  }
}
```

Recipe objects retain the Bar Bot fields: `name`, `description`, `ingredients`, `glass`, `method`, `ice`, `garnish`, and `notes`.

## Safe activation

The route fails closed until `CCC_X402_ENABLED=true`. Set environment variables in the Netlify UI; never commit a wallet secret or facilitator credential.

1. Deploy with `CCC_X402_ENABLED=false`.
2. Set `CCC_X402_PAY_TO` to the receiving Base address.
3. Keep `CCC_X402_NETWORK=eip155:84532` and use `https://x402.org/facilitator` for the testnet trial.
4. Set the desired per-call amount in `CCC_X402_PRICE_USD`.
5. Set `CCC_X402_ENABLED=true`, deploy, and verify an unpaid request returns `402`.
6. Complete a paid Base Sepolia request and confirm both the API result and settlement response.
7. Before mainnet, set `CCC_X402_NETWORK=eip155:8453` and configure a mainnet-capable facilitator. The code refuses to use the public testnet facilitator on mainnet.

The receiving wallet needs only a public address in the service configuration. Private keys belong with the paying client or a facilitator that explicitly requires custody; they do not belong in this repository.

## Scope boundary

This first version adds a paid, agent-ready API without changing the human Bar Bot or membership flows. It is not an exclusive data paywall: the existing `/api/ccc-recipes` and `/api/ccc-bartender` routes remain available, and another CCC application currently consumes the recipe route. Restricting those routes should be a separate migration with client inventory and compatibility testing.

An x402 payment proves payment, not age. If CCC requires legal-drinking-age confirmation or acceptance of alcohol terms for API consumers, enforce that as a separate policy before mainnet activation.

## Smoke checks

```bash
curl -sS https://cryptococktail.club/api/x402

curl -i https://cryptococktail.club/api/x402/bartender \
  -H 'Content-Type: application/json' \
  --data '{"mode":"chat","question":"Left Hand Cocktail spec"}'
```

The second request should return `503` while disabled, then `402` after activation without a payment signature. A `200` should only follow a verified x402 retry.

## Operational notes

- Responses are marked `no-store` and include a request ID for log correlation.
- Netlify applies a 60-request-per-minute IP/domain limit before payment processing.
- The existing `/api/ccc-bartender` and `/api/ccc-recipes` behavior is unchanged by this addition.
- The current generic chat fallback can call the existing OpenAI integration. Exact named recipes and wizard recommendations remain deterministic, and every recipe returned by the paid route is rehydrated from `recipes.json`; unknown or invented recipes are removed before settlement.

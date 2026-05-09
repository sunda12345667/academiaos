# StudentOS Fintech Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    FINANCIAL LAYERS                         │
├─────────────────────────────────────────────────────────────┤
│  UI Layer        useWallet() / useGifting() / useWallet()  │
│  Provider Layer  WalletProvider (realtime balance + txns)  │
│  Service Layer   wallet / gifting / payout / payment       │
│  Risk Layer      risk.engine.js (fraud scoring + signals)  │
│  Ledger Layer    ledger.service.js (double-entry entries)  │
│  Entity Layer    Wallet / Transaction / LedgerEntry        │
│  Gateway Layer   Paystack (primary) / Flutterwave (future) │
└─────────────────────────────────────────────────────────────┘
```

## Entities

| Entity | Role |
|---|---|
| `Wallet` | User balance container (available + locked + bonus) |
| `Transaction` | Immutable event record — every debit/credit |
| `LedgerEntry` | Double-entry ledger — two entries per transaction |
| `PaymentIntent` | Inbound payment tracking (deposit / purchase) |
| `PayoutRequest` | Outbound withdrawal with risk + review lifecycle |
| `Gift` | Gift event (sender → recipient via coin layer) |
| `GiftCatalogItem` | Gift type definitions (cost, emoji, animation, tier) |
| `FraudSignal` | Risk engine events (auto + manual review queue) |

## Balance Model

All amounts stored in **kobo** (smallest NGN unit). ₦1 = 100 kobo.

```
Wallet
  balance          → spendable available balance
  locked_balance   → held for pending payout / escrow
  (bonus_balance)  → future promo credits
```

## Platform Fee Schedule

| Transaction Type | Platform Cut | Creator Gets |
|---|---|---|
| Course sale | 10% | 90% |
| Marketplace sale | 5% (escrow) | 95% |
| Gift received | 30% | 70% |
| Subscription revenue | 20% | 80% |
| Withdrawal fee | ₦100 flat | — |

## Transaction Lifecycle

```
debitWallet() / creditWallet()
  → validate wallet status + balance
  → idempotency check (skip if duplicate key)
  → create Transaction record (immutable audit)
  → create LedgerEntry pair (double-entry)
  → mutate Wallet.balance
  → return { transaction, newBalance }
```

## Transfer Flow (Buyer → Creator)

```
transferBetweenWallets(buyerId, creatorId, amount, opts)
  → debitWallet(buyer, gross_amount)        [TXO_ ref]
  → creditWallet(creator, net_amount)       [TXI_ ref]
  → if credit fails: auto-refund buyer      [REF_ ref]
  → return { debitTx, creditTx, platformFee }
```

## Gifting Flow

```
User buys coins (NGN via Paystack → coin balance)
User sends gift
  → giftingService.sendGift()
  → riskEngine.evaluateGift() → score → action
  → if action === 'block': throw
  → create Gift record (pending)
  → debitWallet(sender, naira_value)
  → creditWallet(creator, naira_value × 70%)
  → update Gift.status = 'delivered'
  → push gift to RealtimeBus → UI animation
```

## Payout Flow

```
creator requestPayout(amount, bankDetails)
  → validate min threshold (₦1,000)
  → check daily limit (KYC-gated)
  → riskEngine.evaluateWithdrawal() → score
  → score > 70: block
  → score 51–70: under_review queue
  → score ≤ 50: pending (auto-approve eligible)
  → lockBalance(amount) [available → locked]
  → create PayoutRequest
  admin approves → status: processing
  Paystack transfer.success webhook
    → paystackWebhook.js handler
    → release locked_balance
    → debitWallet (money left platform)
    → update total_withdrawn
    → status: completed
```

## Payment Intent Flow

```
client: initiatePayment(amount, purpose)
  → create PaymentIntent (status: created, expires: 30min)
  → backend: Paystack initialize API → authorization_url
  → client opens checkout URL
  → user pays on Paystack
  → Paystack fires charge.success webhook
  → paystackWebhook.js: verifySignature → handleChargeSuccess
  → creditWallet(user, amount)
  → PaymentIntent.status = completed
```

## Risk Engine Decision Matrix

| Score | Action | Effect |
|---|---|---|
| 0–30 | `allow` | No signal written |
| 31–50 | `flag` | FraudSignal(severity=medium) |
| 51–70 | `review` | Block + FraudSignal(severity=high) |
| 71–100 | `block` | Hard block + FraudSignal(severity=critical) |

## Risk Signals

| Signal | Trigger |
|---|---|
| `velocity_spike` | >10 transactions in 1 hour |
| `unusual_withdrawal` | Amount > ₦3,000 |
| `new_bank_account_withdrawal` | First withdrawal attempt |
| `withdrawal_velocity` | Daily total > KYC limit |
| `self_gifting_detected` | sender_id === recipient_id |
| `high_value_gift` | Gift > ₦2,000 |
| `coordinated_gift_abuse` | <3 unique senders, >10 gifts, same session |
| `new_account` | Account age < 7 days |
| `kyc_none` | No KYC + high value withdrawal |

## Double-Entry Ledger

Every financial event writes TWO LedgerEntry records:

```
Deposit ₦1,000:
  DEBIT  platform_revenue  ₦1,000  (source)
  CREDIT user_available    ₦1,000  (destination)

Gift send ₦500:
  DEBIT  user_available   ₦500   (sender)
  CREDIT platform_escrow  ₦500   (holding)

Gift receive ₦350 (70%):
  DEBIT  platform_revenue  ₦350
  CREDIT creator_earnings  ₦350

Payout lock ₦2,000:
  DEBIT  user_available  ₦2,000
  CREDIT user_locked     ₦2,000

Payout complete ₦2,000:
  DEBIT  user_locked       ₦2,000
  CREDIT payout_pending    ₦2,000  (then leaves platform)
```

Sum of all DEBITS == Sum of all CREDITS (globally). This is the audit invariant.

## Realtime Provider

`WalletProvider` subscribes to `Transaction` entity via `RealtimeBus`.
- New transaction → prepended to list, balance updated from `balance_after`
- Updated transaction → reconciled in list, full balance re-fetched
- Never directly mutate wallet balance in UI — always trust Transaction records

## Webhook Security

Paystack webhook (`functions/paystackWebhook.js`):
1. Read raw body bytes first
2. Compute HMAC-SHA512(rawBody, PAYSTACK_SECRET_KEY)
3. Compare with `x-paystack-signature` header
4. Reject (400) if mismatch
5. Process ONLY after signature is verified
6. All handlers are idempotent (re-delivery = no-op)
7. Return 200 within 30s to prevent Paystack retry storm

## KYC Tier Limits

| KYC Level | Daily Withdrawal | Notes |
|---|---|---|
| `none` | ₦5,000 | Basic usage |
| `basic` | ₦5,000 | Email verified |
| `enhanced` | ₦50,000 | ID verified |

## Future Roadmap

- [ ] Coin economy (decoupled from NGN direct)
- [ ] Marketplace escrow (lockBalance on order, release on delivery)
- [ ] Subscription billing (recurring PaymentIntent)
- [ ] Gift leaderboards (top gifters per creator)
- [ ] Revenue analytics dashboard (creator earnings over time)
- [ ] Tax/VAT compliance tracking
- [ ] Multi-currency (USD for international creators)
- [ ] Paystack Dedicated Virtual Account (DVA) per user
- [ ] ML-based fraud scoring (replace rule-based risk engine)
- [ ] School wallets (institution-level balance for licensing)
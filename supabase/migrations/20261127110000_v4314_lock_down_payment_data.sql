-- Keep private financial configuration and transaction rows inaccessible to browser roles.
BEGIN;
ALTER TABLE austa_private.service_commission_tariffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE austa_private.service_financial_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE austa_private.payment_topup_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE austa_private.payment_provider_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON austa_private.service_commission_tariffs FROM PUBLIC,anon,authenticated;
REVOKE ALL ON austa_private.service_financial_records FROM PUBLIC,anon,authenticated;
REVOKE ALL ON austa_private.payment_topup_intents FROM PUBLIC,anon,authenticated;
REVOKE ALL ON austa_private.payment_provider_events FROM PUBLIC,anon,authenticated;
-- A user's app sees only masked card metadata; provider tokens stay server-side.
REVOKE ALL ON austa_private.saved_payment_tokens FROM PUBLIC,anon,authenticated;
GRANT SELECT(id,owner_id,provider,brand,last4,exp_month,exp_year,created_at)
  ON austa_private.saved_payment_tokens TO authenticated;
COMMIT;

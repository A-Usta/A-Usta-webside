-- Private, owner-scoped wallet summary for the mobile provider cabinet.
BEGIN;

CREATE OR REPLACE FUNCTION public.austa_get_my_wallet_statement()
RETURNS TABLE(
  balance_minor bigint,
  reserved_minor bigint,
  currency text,
  earnings_minor bigint,
  commission_minor bigint,
  ledger jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT COALESCE(w.balance_minor,0),
    COALESCE(w.reserved_minor,0),
    COALESCE(w.currency,'AZN'),
    COALESCE((SELECT sum(fr.provider_earning_minor) FROM austa_private.service_financial_records fr
      WHERE fr.provider_id=auth.uid() AND fr.status='settled'),0)::bigint,
    COALESCE((SELECT sum(fr.commission_minor) FROM austa_private.service_financial_records fr
      WHERE fr.provider_id=auth.uid() AND fr.status='settled'),0)::bigint,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id',l.id,'entry_type',l.entry_type,
      'amount_delta_minor',l.amount_delta_minor,'reserved_delta_minor',l.reserved_delta_minor,
      'currency',l.currency,'order_id',l.order_id,'created_at',l.created_at) ORDER BY l.id DESC)
      FROM (SELECT * FROM austa_private.provider_wallet_ledger
        WHERE owner_id=auth.uid() ORDER BY id DESC LIMIT 50) l),'[]'::jsonb)
  FROM (SELECT auth.uid() AS owner_id) actor
  LEFT JOIN austa_private.provider_wallets w ON w.owner_id=actor.owner_id
  WHERE actor.owner_id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.austa_get_my_wallet_statement() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.austa_get_my_wallet_statement() TO authenticated;

COMMIT;

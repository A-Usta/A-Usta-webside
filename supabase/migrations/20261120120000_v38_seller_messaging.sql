-- V3.8 participant-only listing conversations. Apply to the disposable TEST
-- project first; the release owner must separately authorize production.
BEGIN;

CREATE SCHEMA IF NOT EXISTS austa_private;

DO $preflight$
BEGIN
 IF pg_catalog.to_regprocedure('austa_private.v36_listing_exists(text,uuid,boolean)') IS NULL
    OR pg_catalog.to_regclass('austa_private.listing_detail_metrics') IS NULL THEN
  RAISE EXCEPTION 'V3.8 requires the reviewed V3.6 listing metrics contract';
 END IF;
 IF NOT pg_catalog.has_table_privilege(current_user,'auth.users','SELECT') THEN
  RAISE EXCEPTION 'V3.8 migration owner must be able to read auth.users for the narrow public registration-date RPC';
 END IF;
END;
$preflight$;

CREATE TABLE austa_private.listing_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_source text NOT NULL CHECK (listing_source IN ('vehicle','marketplace','service_provider','auto_dealer')),
  listing_id uuid NOT NULL,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_message_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT listing_conversations_not_self CHECK (buyer_id <> seller_id),
  CONSTRAINT listing_conversations_listing_buyer_key UNIQUE (listing_source,listing_id,buyer_id)
);

CREATE TABLE austa_private.listing_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES austa_private.listing_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_message_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  read_at timestamptz,
  CONSTRAINT listing_messages_request_key UNIQUE (conversation_id,sender_id,client_message_id)
);

CREATE INDEX listing_conversations_buyer_recent_idx ON austa_private.listing_conversations(buyer_id,last_message_at DESC,id);
CREATE INDEX listing_conversations_seller_recent_idx ON austa_private.listing_conversations(seller_id,last_message_at DESC,id);
CREATE INDEX listing_messages_conversation_recent_idx ON austa_private.listing_messages(conversation_id,created_at,id);
CREATE INDEX listing_messages_unread_idx ON austa_private.listing_messages(conversation_id,created_at) WHERE read_at IS NULL;

ALTER TABLE austa_private.listing_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE austa_private.listing_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS listing_conversations_participant_read ON austa_private.listing_conversations;
CREATE POLICY listing_conversations_participant_read ON austa_private.listing_conversations
  FOR SELECT TO authenticated USING (buyer_id=auth.uid() OR seller_id=auth.uid());
DROP POLICY IF EXISTS listing_messages_participant_read ON austa_private.listing_messages;
CREATE POLICY listing_messages_participant_read ON austa_private.listing_messages
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM austa_private.listing_conversations c
    WHERE c.id=conversation_id AND (c.buyer_id=auth.uid() OR c.seller_id=auth.uid())
  ));
DROP POLICY IF EXISTS listing_messages_recipient_read_marker ON austa_private.listing_messages;
CREATE POLICY listing_messages_recipient_read_marker ON austa_private.listing_messages
  FOR UPDATE TO authenticated USING (sender_id<>auth.uid() AND EXISTS (
    SELECT 1 FROM austa_private.listing_conversations c
    WHERE c.id=conversation_id AND (c.buyer_id=auth.uid() OR c.seller_id=auth.uid())
  )) WITH CHECK (sender_id<>auth.uid() AND EXISTS (
    SELECT 1 FROM austa_private.listing_conversations c
    WHERE c.id=conversation_id AND (c.buyer_id=auth.uid() OR c.seller_id=auth.uid())
  ));
REVOKE ALL ON austa_private.listing_conversations,austa_private.listing_messages FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.austa_open_listing_conversation(p_source text,p_listing_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE actor uuid:=auth.uid(); owner uuid; conversation uuid;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='28000'; END IF;
 IF p_source IS NULL OR p_listing_id IS NULL OR p_source NOT IN ('vehicle','marketplace','service_provider','auto_dealer') THEN
  RAISE EXCEPTION 'Invalid listing reference' USING ERRCODE='22023';
 END IF;
 SELECT l.owner_id INTO owner FROM austa_private.v36_listing_exists(p_source,p_listing_id,true) l;
 IF owner IS NULL THEN RAISE EXCEPTION 'Listing unavailable' USING ERRCODE='22023'; END IF;
 IF owner=actor THEN RAISE EXCEPTION 'Cannot message your own listing' USING ERRCODE='42501'; END IF;
 INSERT INTO austa_private.listing_conversations(listing_source,listing_id,buyer_id,seller_id)
 VALUES(p_source,p_listing_id,actor,owner) ON CONFLICT(listing_source,listing_id,buyer_id) DO NOTHING;
 SELECT c.id INTO conversation FROM austa_private.listing_conversations c
 WHERE c.listing_source=p_source AND c.listing_id=p_listing_id AND c.buyer_id=actor AND c.seller_id=owner;
 IF conversation IS NULL THEN RAISE EXCEPTION 'Conversation unavailable' USING ERRCODE='42501'; END IF;
 RETURN conversation;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.austa_send_listing_message(p_conversation_id uuid,p_client_message_id uuid,p_body text)
RETURNS TABLE(message_id uuid,sender_id uuid,body text,created_at timestamptz,read_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE actor uuid:=auth.uid(); c austa_private.listing_conversations%ROWTYPE; inserted_id uuid;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='28000'; END IF;
 IF p_conversation_id IS NULL OR p_client_message_id IS NULL OR p_body IS NULL OR char_length(btrim(p_body)) NOT BETWEEN 1 AND 4000 THEN
  RAISE EXCEPTION 'Invalid message' USING ERRCODE='22023';
 END IF;
 SELECT * INTO c FROM austa_private.listing_conversations WHERE id=p_conversation_id FOR UPDATE;
 IF NOT FOUND OR actor NOT IN (c.buyer_id,c.seller_id) THEN RAISE EXCEPTION 'Conversation unavailable' USING ERRCODE='42501'; END IF;
 INSERT INTO austa_private.listing_messages(conversation_id,sender_id,client_message_id,body)
 VALUES(c.id,actor,p_client_message_id,btrim(p_body))
 ON CONFLICT ON CONSTRAINT listing_messages_request_key DO NOTHING RETURNING id INTO inserted_id;
 IF inserted_id IS NULL THEN
  SELECT m.id INTO inserted_id FROM austa_private.listing_messages m
  WHERE m.conversation_id=c.id AND m.sender_id=actor AND m.client_message_id=p_client_message_id;
 END IF;
 UPDATE austa_private.listing_conversations SET last_message_at=(SELECT m.created_at FROM austa_private.listing_messages m WHERE m.id=inserted_id) WHERE id=c.id;
 RETURN QUERY SELECT m.id,m.sender_id,m.body,m.created_at,m.read_at FROM austa_private.listing_messages m WHERE m.id=inserted_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.austa_get_listing_messages(p_conversation_id uuid)
RETURNS TABLE(message_id uuid,sender_id uuid,body text,created_at timestamptz,read_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE actor uuid:=auth.uid();
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='28000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM austa_private.listing_conversations c WHERE c.id=p_conversation_id AND actor IN(c.buyer_id,c.seller_id)) THEN
  RAISE EXCEPTION 'Conversation unavailable' USING ERRCODE='42501';
 END IF;
 RETURN QUERY SELECT m.id,m.sender_id,m.body,m.created_at,m.read_at FROM austa_private.listing_messages m
 WHERE m.conversation_id=p_conversation_id ORDER BY m.created_at,m.id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.austa_mark_listing_messages_read(p_conversation_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE actor uuid:=auth.uid(); changed integer;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='28000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM austa_private.listing_conversations c WHERE c.id=p_conversation_id AND actor IN(c.buyer_id,c.seller_id)) THEN
  RAISE EXCEPTION 'Conversation unavailable' USING ERRCODE='42501';
 END IF;
 UPDATE austa_private.listing_messages SET read_at=clock_timestamp()
 WHERE conversation_id=p_conversation_id AND sender_id<>actor AND read_at IS NULL;
 GET DIAGNOSTICS changed=ROW_COUNT; RETURN changed;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.austa_list_listing_conversations()
RETURNS TABLE(conversation_id uuid,listing_source text,listing_id uuid,public_number bigint,last_message_at timestamptz,last_message text,unread_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE actor uuid:=auth.uid();
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='28000'; END IF;
 RETURN QUERY SELECT c.id,c.listing_source,c.listing_id,d.public_number,c.last_message_at,
  (SELECT m.body FROM austa_private.listing_messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1),
  (SELECT count(*) FROM austa_private.listing_messages m WHERE m.conversation_id=c.id AND m.sender_id<>actor AND m.read_at IS NULL)
 FROM austa_private.listing_conversations c
 LEFT JOIN austa_private.listing_detail_metrics d ON d.listing_source=c.listing_source AND d.listing_id=c.listing_id
 WHERE actor IN(c.buyer_id,c.seller_id) ORDER BY c.last_message_at DESC,c.id LIMIT 100;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.austa_unread_listing_message_count()
RETURNS bigint LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE actor uuid:=auth.uid(); total bigint;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='28000'; END IF;
 SELECT count(*) INTO total FROM austa_private.listing_messages m
 JOIN austa_private.listing_conversations c ON c.id=m.conversation_id
 WHERE actor IN(c.buyer_id,c.seller_id) AND m.sender_id<>actor AND m.read_at IS NULL;
 RETURN total;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.austa_get_listing_seller_registered_at(p_source text,p_listing_id uuid)
RETURNS TABLE(registered_at timestamptz) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE owner uuid;
BEGIN
 IF p_source IS NULL OR p_listing_id IS NULL OR p_source NOT IN ('vehicle','marketplace','service_provider','auto_dealer') THEN RETURN; END IF;
 SELECT l.owner_id INTO owner FROM austa_private.v36_listing_exists(p_source,p_listing_id,true) l;
 IF owner IS NULL THEN RETURN; END IF;
 RETURN QUERY SELECT u.created_at FROM auth.users u WHERE u.id=owner;
END;
$fn$;

REVOKE ALL ON FUNCTION public.austa_open_listing_conversation(text,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.austa_send_listing_message(uuid,uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.austa_get_listing_messages(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.austa_mark_listing_messages_read(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.austa_list_listing_conversations() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.austa_unread_listing_message_count() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.austa_get_listing_seller_registered_at(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.austa_open_listing_conversation(text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.austa_send_listing_message(uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.austa_get_listing_messages(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.austa_mark_listing_messages_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.austa_list_listing_conversations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.austa_unread_listing_message_count() TO authenticated;
GRANT EXECUTE ON FUNCTION public.austa_get_listing_seller_registered_at(text,uuid) TO anon,authenticated;

COMMIT;

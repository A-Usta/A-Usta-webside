-- Defense in depth for the private V4.3 engagement tables. The client receives
-- no direct table grants; RPCs remain the only public interface.
BEGIN;
DROP POLICY IF EXISTS listing_video_views_owner_read ON austa_private.listing_video_views;
CREATE POLICY listing_video_views_owner_read ON austa_private.listing_video_views
  FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS listing_video_likes_owner_read ON austa_private.listing_video_likes;
CREATE POLICY listing_video_likes_owner_read ON austa_private.listing_video_likes
  FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS listing_video_comments_owner_read ON austa_private.listing_video_comments;
CREATE POLICY listing_video_comments_owner_read ON austa_private.listing_video_comments
  FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS listing_video_comments_owner_insert ON austa_private.listing_video_comments;
CREATE POLICY listing_video_comments_owner_insert ON austa_private.listing_video_comments
  FOR INSERT TO authenticated WITH CHECK (user_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS listing_video_comments_owner_delete ON austa_private.listing_video_comments;
CREATE POLICY listing_video_comments_owner_delete ON austa_private.listing_video_comments
  FOR DELETE TO authenticated USING (user_id=(SELECT auth.uid()));
COMMIT;

CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_users', (SELECT count(*) FROM profiles),
    'total_waitlist', (SELECT count(*) FROM waitlist),
    'total_leagues', (SELECT count(*) FROM leagues),
    'dau_today', (SELECT count(*) FROM auth.users WHERE last_sign_in_at >= CURRENT_DATE),
    'dau_7d_avg', (SELECT round(count(*)::numeric / 7, 1) FROM auth.users WHERE last_sign_in_at >= CURRENT_DATE - INTERVAL '7 days'),
    'dau_30d_avg', (SELECT round(count(*)::numeric / 30, 1) FROM auth.users WHERE last_sign_in_at >= CURRENT_DATE - INTERVAL '30 days')
  ) INTO result;
  RETURN result;
END;
$$;

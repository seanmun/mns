-- Atomic trade execution stored procedure.
-- Replaces the multi-step client-side flow in tradeExecution.ts with a single
-- database transaction that locks assets, verifies ownership, moves players/picks,
-- updates keeper rosters, cancels conflicting proposals, and marks the trade executed.
--
-- Called via: supabase.rpc('execute_trade', { ... })

CREATE OR REPLACE FUNCTION execute_trade(
  p_proposal_id TEXT,
  p_league_id TEXT,
  p_assets JSONB,
  p_executed_by TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_proposal RECORD;
  v_asset JSONB;
  v_player RECORD;
  v_pick RECORD;
  v_roster RECORD;
  v_entries JSONB;
  v_filtered JSONB;
  v_entry JSONB;
  v_roster_id TEXT;
  v_team_id TEXT;
  v_from_team TEXT;
  v_to_team TEXT;
  v_asset_type TEXT;
  v_asset_id TEXT;
  v_slot TEXT;
  v_decision TEXT;
  v_all_asset_ids TEXT[];
  v_team_ids TEXT[];
  v_conflicting_ids TEXT[];
  v_other RECORD;
  v_other_asset JSONB;
  v_other_id TEXT;
BEGIN
  -- ═══════════════════════════════════════════════════════════════════════
  -- 1. LOCK AND VERIFY PROPOSAL
  -- ═══════════════════════════════════════════════════════════════════════
  SELECT * INTO v_proposal
  FROM trade_proposals
  WHERE id = p_proposal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Proposal not found');
  END IF;

  IF v_proposal.status != 'pending' THEN
    RETURN json_build_object('success', false, 'error',
      'Proposal is already ' || v_proposal.status);
  END IF;

  -- Collect all asset IDs for conflict detection later
  SELECT array_agg(elem->>'id')
  INTO v_all_asset_ids
  FROM jsonb_array_elements(p_assets) AS elem;

  -- Collect all involved team IDs
  SELECT array_agg(DISTINCT tid) INTO v_team_ids
  FROM (
    SELECT elem->>'fromTeamId' AS tid FROM jsonb_array_elements(p_assets) AS elem
    UNION
    SELECT elem->>'toTeamId' AS tid FROM jsonb_array_elements(p_assets) AS elem
  ) sub;

  -- ═══════════════════════════════════════════════════════════════════════
  -- 2. LOCK AND VERIFY ALL PLAYER ASSETS
  -- ═══════════════════════════════════════════════════════════════════════
  FOR v_asset IN SELECT * FROM jsonb_array_elements(p_assets)
  LOOP
    v_asset_type := v_asset.value->>'type';
    v_asset_id := v_asset.value->>'id';
    v_from_team := v_asset.value->>'fromTeamId';
    v_to_team := v_asset.value->>'toTeamId';

    IF v_asset_type != 'rookie_pick' THEN
      -- Lock the player row and verify ownership
      SELECT * INTO v_player
      FROM players
      WHERE id = v_asset_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error',
          'Player ' || v_asset_id || ' not found');
      END IF;

      IF v_player.team_id IS DISTINCT FROM v_from_team THEN
        RETURN json_build_object('success', false, 'error',
          v_player.name || ' no longer belongs to the sending team. They may have been moved by another trade.');
      END IF;
    ELSE
      -- Lock the rookie pick row and verify ownership
      SELECT * INTO v_pick
      FROM rookie_draft_picks
      WHERE id = v_asset_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error',
          'Draft pick ' || v_asset_id || ' not found');
      END IF;

      IF v_pick.current_owner IS DISTINCT FROM v_from_team THEN
        RETURN json_build_object('success', false, 'error',
          'Draft pick ' || v_asset_id || ' no longer belongs to the sending team. It may have been moved by another trade.');
      END IF;
    END IF;
  END LOOP;

  -- ═══════════════════════════════════════════════════════════════════════
  -- 3. UPDATE KEEPER ROSTER ENTRIES
  -- For each involved team: remove outgoing players, add incoming players
  -- ═══════════════════════════════════════════════════════════════════════
  FOREACH v_team_id IN ARRAY v_team_ids
  LOOP
    v_roster_id := p_league_id || '_' || v_team_id;

    SELECT * INTO v_roster
    FROM rosters
    WHERE id = v_roster_id
    FOR UPDATE;

    IF FOUND THEN
      v_entries := COALESCE(v_roster.entries, '[]'::jsonb);

      -- Remove outgoing players from this team's entries
      v_filtered := '[]'::jsonb;
      FOR v_entry IN SELECT * FROM jsonb_array_elements(v_entries)
      LOOP
        -- Keep entry if it's NOT a player being traded away from this team
        IF NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(p_assets) AS a
          WHERE a.value->>'type' != 'rookie_pick'
            AND a.value->>'id' = v_entry.value->>'playerId'
            AND a.value->>'fromTeamId' = v_team_id
        ) THEN
          v_filtered := v_filtered || jsonb_build_array(v_entry.value);
        END IF;
      END LOOP;

      -- Add incoming players to this team's entries
      FOR v_asset IN SELECT * FROM jsonb_array_elements(p_assets)
      LOOP
        IF v_asset.value->>'type' != 'rookie_pick'
           AND v_asset.value->>'toTeamId' = v_team_id THEN
          v_asset_type := v_asset.value->>'type';
          v_decision := CASE v_asset_type
            WHEN 'redshirt' THEN 'REDSHIRT'
            WHEN 'int_stash' THEN 'INT_STASH'
            ELSE 'KEEP'
          END;

          v_filtered := v_filtered || jsonb_build_array(
            jsonb_build_object(
              'playerId', v_asset.value->>'id',
              'decision', v_decision,
              'baseRound', 13
            )
          );
        END IF;
      END LOOP;

      -- Save updated entries
      UPDATE rosters
      SET entries = v_filtered,
          updated_at = now()
      WHERE id = v_roster_id;
    END IF;
  END LOOP;

  -- ═══════════════════════════════════════════════════════════════════════
  -- 4. TRANSFER PLAYERS (update players.team_id + slot)
  -- ═══════════════════════════════════════════════════════════════════════
  FOR v_asset IN SELECT * FROM jsonb_array_elements(p_assets)
  LOOP
    v_asset_type := v_asset.value->>'type';
    v_asset_id := v_asset.value->>'id';
    v_to_team := v_asset.value->>'toTeamId';

    IF v_asset_type != 'rookie_pick' THEN
      v_slot := CASE v_asset_type
        WHEN 'redshirt' THEN 'redshirt'
        WHEN 'int_stash' THEN 'international'
        ELSE 'active'
      END;

      UPDATE players
      SET team_id = v_to_team,
          slot = v_slot,
          on_ir = false
      WHERE id = v_asset_id;
    ELSE
      -- Transfer rookie pick ownership
      UPDATE rookie_draft_picks
      SET current_owner = v_to_team,
          updated_at = now()
      WHERE id = v_asset_id;
    END IF;
  END LOOP;

  -- ═══════════════════════════════════════════════════════════════════════
  -- 5. CANCEL CONFLICTING PENDING PROPOSALS
  -- Any other pending proposal involving the same assets gets cancelled
  -- ═══════════════════════════════════════════════════════════════════════
  v_conflicting_ids := ARRAY[]::TEXT[];

  FOR v_other IN
    SELECT id, assets
    FROM trade_proposals
    WHERE league_id = p_league_id
      AND status = 'pending'
      AND id != p_proposal_id
    FOR UPDATE
  LOOP
    FOR v_other_asset IN SELECT * FROM jsonb_array_elements(v_other.assets)
    LOOP
      v_other_id := v_other_asset.value->>'id';
      IF v_other_id = ANY(v_all_asset_ids) THEN
        v_conflicting_ids := array_append(v_conflicting_ids, v_other.id);
        EXIT; -- Found one overlap, no need to check more assets in this proposal
      END IF;
    END LOOP;
  END LOOP;

  IF array_length(v_conflicting_ids, 1) > 0 THEN
    UPDATE trade_proposals
    SET status = 'cancelled',
        updated_at = now()
    WHERE id = ANY(v_conflicting_ids);
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════
  -- 6. MARK PROPOSAL AS EXECUTED
  -- ═══════════════════════════════════════════════════════════════════════
  UPDATE trade_proposals
  SET status = 'executed',
      executed_at = now(),
      executed_by = p_executed_by,
      updated_at = now()
  WHERE id = p_proposal_id;

  RETURN json_build_object(
    'success', true,
    'cancelled_proposals', COALESCE(array_length(v_conflicting_ids, 1), 0)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

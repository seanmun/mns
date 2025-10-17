/**
 * Migration Script: Create pickAssignments collection from existing drafts
 *
 * This creates a new collection where each draft pick is an independent document
 * that can be traded without breaking the UI or requiring complex syncing.
 *
 * Run with: node migrate-to-pick-assignments.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrate() {
  console.log('🚀 Starting migration to pickAssignments collection...\n');

  try {
    // Get all drafts
    const draftsSnap = await db.collection('drafts').get();

    if (draftsSnap.empty) {
      console.log('❌ No drafts found');
      return;
    }

    console.log(`📋 Found ${draftsSnap.size} draft(s)\n`);

    let totalPicks = 0;

    for (const draftDoc of draftsSnap.docs) {
      const draft = draftDoc.data();
      const draftId = draftDoc.id;

      console.log(`Processing draft: ${draftId}`);
      console.log(`  League: ${draft.leagueId}`);
      console.log(`  Season: ${draft.seasonYear}`);
      console.log(`  Status: ${draft.status}`);
      console.log(`  Total picks: ${draft.picks?.length || 0}\n`);

      if (!draft.picks || draft.picks.length === 0) {
        console.log('  ⚠️  No picks in this draft, skipping\n');
        continue;
      }

      // Load draft pick ownership (for trade tracking)
      const draftPicksSnap = await db.collection('draftPicks')
        .where('leagueId', '==', draft.leagueId)
        .get();

      const pickOwnership = new Map();
      draftPicksSnap.docs.forEach(doc => {
        const pick = doc.data();
        pickOwnership.set(pick.pickNumber, {
          currentOwner: pick.currentOwner,
          originalOwner: pick.originalTeam
        });
      });

      console.log(`  📊 Loaded ${pickOwnership.size} traded pick records\n`);

      // Create pickAssignment document for each pick
      const batch = db.batch();
      let batchCount = 0;

      for (const pick of draft.picks) {
        const pickId = `${draft.leagueId}_${draft.seasonYear}_pick_${pick.overallPick}`;

        // Determine current owner (accounting for trades)
        const ownership = pickOwnership.get(pick.overallPick);
        const currentTeamId = ownership?.currentOwner || pick.teamId;
        const originalTeamId = ownership?.originalOwner || pick.teamId;
        const wasTraded = currentTeamId !== originalTeamId;

        const pickAssignment = {
          id: pickId,
          leagueId: draft.leagueId,
          seasonYear: draft.seasonYear,

          // Pick position
          round: pick.round,
          pickInRound: pick.pickInRound,
          overallPick: pick.overallPick,

          // Ownership
          currentTeamId: currentTeamId,
          originalTeamId: originalTeamId,
          originalTeamName: pick.teamName,
          originalTeamAbbrev: pick.teamAbbrev,

          // Player assignment
          playerId: pick.playerId || null,
          playerName: pick.playerName || null,

          // Metadata
          isKeeperSlot: pick.isKeeperSlot || false,
          pickedAt: pick.pickedAt || null,
          pickedBy: pick.pickedBy || null,

          // Trade tracking
          wasTraded: wasTraded,
          tradeHistory: wasTraded ? [{
            from: originalTeamId,
            to: currentTeamId,
            tradedAt: null // We don't have this data
          }] : [],

          // Timestamps
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const pickRef = db.collection('pickAssignments').doc(pickId);
        batch.set(pickRef, pickAssignment);

        batchCount++;
        totalPicks++;

        // Commit batch every 500 operations (Firestore limit)
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`  ✅ Committed batch of ${batchCount} picks`);
          batchCount = 0;
        }
      }

      // Commit remaining picks
      if (batchCount > 0) {
        await batch.commit();
        console.log(`  ✅ Committed final batch of ${batchCount} picks`);
      }

      console.log(`  ✨ Completed draft ${draftId}\n`);
    }

    console.log(`\n🎉 Draft picks migration complete!`);
    console.log(`📊 Total picks migrated: ${totalPicks}`);
    console.log(`\n✅ New collection 'pickAssignments' created with ${totalPicks} documents\n`);

    // PART 2: Create keeperFees collection
    console.log(`📋 Creating keeperFees collection to lock in keeper-phase fees...\n`);

    const teamsSnap = await db.collection('teams')
      .where('leagueId', '==', draft.leagueId)
      .get();

    const rostersSnap = await db.collection('rosters').get();
    let totalFees = 0;

    for (const teamDoc of teamsSnap.docs) {
      const team = teamDoc.data();
      const teamId = teamDoc.id;
      const rosterId = `${draft.leagueId}_${teamId}`;

      // Find roster
      const rosterDoc = rostersSnap.docs.find(d => d.id === rosterId);
      if (!rosterDoc) {
        console.log(`  ⚠️  No roster found for team ${team.name}, skipping`);
        continue;
      }

      const roster = rosterDoc.data();

      // Count franchise tags (from roster summary if available)
      const franchiseTagCount = roster.summary?.franchiseTagDues ? Math.round(roster.summary.franchiseTagDues / 15) : 0;
      const franchiseTagFees = franchiseTagCount * 15;

      // Count redshirts
      const redshirtCount = roster.entries?.filter(e => e.decision === 'REDSHIRT')?.length || 0;
      const redshirtFees = redshirtCount * 10;

      const keeperFeesId = `${draft.leagueId}_${teamId}_${draft.seasonYear}`;
      const keeperFeesDoc = {
        id: keeperFeesId,
        leagueId: draft.leagueId,
        teamId: teamId,
        seasonYear: draft.seasonYear,

        // Fees
        franchiseTagFees: franchiseTagFees,
        redshirtFees: redshirtFees,

        // Breakdown
        franchiseTagCount: franchiseTagCount,
        redshirtCount: redshirtCount,

        // Metadata
        lockedAt: roster.submittedAt || Date.now(),
        lockedBy: 'migration_script',

        // Timestamps
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await db.collection('keeperFees').doc(keeperFeesId).set(keeperFeesDoc);
      totalFees++;

      console.log(`  ✅ ${team.name}: ${franchiseTagCount} franchise tags ($${franchiseTagFees}), ${redshirtCount} redshirts ($${redshirtFees})`);
    }

    console.log(`\n🎉 Keeper fees migration complete!`);
    console.log(`📊 Total teams processed: ${totalFees}`);
    console.log(`\n✅ New collection 'keeperFees' created with ${totalFees} documents`);

    console.log(`\n⚠️  Next steps:`);
    console.log(`   1. Test both team pages display correctly`);
    console.log(`   2. Fix the 3 traded picks manually in Firebase Console`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
migrate()
  .then(() => {
    console.log('\n✅ Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });

const admin = require('firebase-admin');

// Initialize with default credentials
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'mns-app-89af2'
  });
}

const db = admin.firestore();

async function findNazReid() {
  console.log('=== Searching for Naz Reid ===\n');

  // Check players collection
  console.log('1. Checking players collection...');
  const playersSnap = await db.collection('players').get();
  console.log(`   Total players: ${playersSnap.size}`);

  let nazDoc = null;
  let nazId = null;

  playersSnap.forEach(doc => {
    const data = doc.data();
    if (data.name && data.name.toLowerCase().includes('naz')) {
      nazDoc = doc;
      nazId = doc.id;
      console.log('   ✅ Found Naz Reid in players:');
      console.log('   ID:', doc.id);
      console.log('   Name:', data.name);
      console.log('   NBA Team:', data.nbaTeam);
      console.log('   Salary:', data.salary);
    }
  });

  if (!nazDoc) {
    console.log('   ❌ Naz Reid NOT found in players collection');
    process.exit(0);
  }

  // Check regularSeasonRosters
  console.log('\n2. Checking regularSeasonRosters collection...');
  const rostersSnap = await db.collection('regularSeasonRosters').get();
  console.log(`   Total rosters: ${rostersSnap.size}`);

  let foundInRoster = false;

  rostersSnap.forEach(doc => {
    const roster = doc.data();
    const allPlayerIds = [
      ...(roster.activeRoster || []),
      ...(roster.irSlots || []),
      ...(roster.redshirtPlayers || []),
      ...(roster.internationalPlayers || [])
    ];

    if (allPlayerIds.includes(nazId)) {
      foundInRoster = true;
      console.log(`   ✅ Found ${nazId} in roster: ${doc.id}`);
      console.log(`      Team ID: ${roster.teamId}`);
      console.log(`      Active: ${roster.activeRoster && roster.activeRoster.includes(nazId) ? 'YES' : 'no'}`);
      console.log(`      IR: ${roster.irSlots && roster.irSlots.includes(nazId) ? 'YES' : 'no'}`);
      console.log(`      Redshirt: ${roster.redshirtPlayers && roster.redshirtPlayers.includes(nazId) ? 'YES' : 'no'}`);
      console.log(`      Int: ${roster.internationalPlayers && roster.internationalPlayers.includes(nazId) ? 'YES' : 'no'}`);
    }
  });

  if (!foundInRoster) {
    console.log(`   ❌ ${nazId} NOT found in any roster - should be a free agent`);
  }

  process.exit(0);
}

findNazReid().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

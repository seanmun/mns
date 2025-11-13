// Script to fix activation fees that were incorrectly stored in redshirtFees
// Run this with: node fix-activation-fees.js

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

// Your Firebase config (copy from src/lib/firebase.ts)
const firebaseConfig = {
  // Add your config here
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixActivationFees() {
  console.log('Starting to fix activation fees...\n');

  try {
    const feesSnapshot = await getDocs(collection(db, 'teamFees'));

    for (const feeDoc of feesSnapshot.docs) {
      const data = feeDoc.data();
      const teamId = data.teamId;
      const seasonYear = data.seasonYear;

      console.log(`\nChecking ${teamId} - Season ${seasonYear}:`);
      console.log(`  Current redshirtFees: $${data.redshirtFees || 0}`);
      console.log(`  Current unredshirtFees: $${data.unredshirtFees || 0}`);
      console.log(`  Current totalFees: $${data.totalFees || 0}`);

      // Count activation transactions that were logged in feeTransactions
      const activationTransactions = (data.feeTransactions || [])
        .filter(t => t.note && t.note.includes('Activated') && t.note.includes('from redshirt'));

      const activationFeesFromTransactions = activationTransactions.reduce((sum, t) => sum + t.amount, 0);

      console.log(`  Found ${activationTransactions.length} activation transactions totaling $${activationFeesFromTransactions}`);

      if (activationFeesFromTransactions > 0) {
        // Move activation fees from redshirtFees to unredshirtFees
        const correctedRedshirtFees = (data.redshirtFees || 0) - activationFeesFromTransactions;
        const correctedUnredshirtFees = (data.unredshirtFees || 0) + activationFeesFromTransactions;

        console.log(`  FIXING: Moving $${activationFeesFromTransactions} from redshirtFees to unredshirtFees`);
        console.log(`  New redshirtFees: $${correctedRedshirtFees}`);
        console.log(`  New unredshirtFees: $${correctedUnredshirtFees}`);

        await updateDoc(doc(db, 'teamFees', feeDoc.id), {
          redshirtFees: correctedRedshirtFees,
          unredshirtFees: correctedUnredshirtFees,
        });

        console.log(`  ✓ Updated ${feeDoc.id}`);
      } else {
        console.log(`  No corrections needed`);
      }
    }

    console.log('\n✓ Done fixing activation fees!');
  } catch (error) {
    console.error('Error fixing fees:', error);
  }
}

fixActivationFees();

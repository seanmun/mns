// Quick script to convert pick 42 (round 5, pick 2) from keeper slot to regular pick
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBxb1KZqmSKCD-dYQG_-R9lmF-aOQDJu9I",
  authDomain: "mns-app-1bacc.firebaseapp.com",
  projectId: "mns-app-1bacc",
  storageBucket: "mns-app-1bacc.firebasestorage.app",
  messagingSenderId: "994543524249",
  appId: "1:994543524249:web:b59d6fe76dfe88bc43e076"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixPick() {
  try {
    const draftRef = doc(db, 'drafts', 'mns2026_2026');
    const draftSnap = await getDoc(draftRef);

    if (!draftSnap.exists()) {
      console.error('Draft not found');
      return;
    }

    const draft = draftSnap.data();
    const picks = draft.picks;

    // Find round 5, pick 2 (overall pick 42)
    const pickToFix = picks.find(p => p.round === 5 && p.pickInRound === 2);

    if (!pickToFix) {
      console.error('Pick not found');
      return;
    }

    console.log('Found pick:', pickToFix);
    console.log('Overall pick #:', pickToFix.overallPick);
    console.log('isKeeperSlot:', pickToFix.isKeeperSlot);

    // Update the pick to convert keeper slot to regular pick
    const updatedPicks = picks.map(p => {
      if (p.overallPick === pickToFix.overallPick) {
        return {
          ...p,
          isKeeperSlot: false
        };
      }
      return p;
    });

    await updateDoc(draftRef, { picks: updatedPicks });
    console.log('✅ Pick fixed! isKeeperSlot set to false');

  } catch (error) {
    console.error('Error:', error);
  }
}

fixPick();

const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

admin.initializeApp();

/**
 * Cloud Function that sends Telegram notification when a draft pick is made
 * Triggers on any update to /drafts/{draftId}
 */
exports.sendDraftPickNotification = onDocumentUpdated('drafts/{draftId}', async (event) => {
    const change = event.data;
    if (!change) {
      console.log('No data in event');
      return null;
    }
    const beforeData = change.before.data();
    const afterData = change.after.data();

    // Check if a new pick was made by comparing picks with pickedAt timestamps
    const beforePicks = beforeData.picks || [];
    const afterPicks = afterData.picks || [];

    // Find the pick that was just made (has pickedAt in after but not before)
    let latestPick = null;
    for (let i = 0; i < afterPicks.length; i++) {
      const afterPick = afterPicks[i];
      const beforePick = beforePicks[i];

      // Check if this pick just got filled (has pickedAt now but didn't before)
      if (afterPick.pickedAt && (!beforePick || !beforePick.pickedAt)) {
        latestPick = afterPick;
        break;
      }
    }

    if (!latestPick) {
      console.log('No new pick detected, skipping notification');
      return null;
    }

    if (!latestPick.playerId || !latestPick.pickedAt) {
      console.log('Latest pick has no player or timestamp, skipping');
      return null;
    }

    // Get Telegram bot credentials from environment variables
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatIds = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatIds) {
      console.error('Telegram bot credentials not configured in functions config');
      return null;
    }

    // Fetch player details
    const playerSnap = await admin.firestore().collection('players').doc(latestPick.playerId).get();
    const player = playerSnap.data();

    if (!player) {
      console.error('Player not found:', latestPick.playerId);
      return null;
    }

    // Fetch team details
    const teamSnap = await admin.firestore().collection('teams').doc(latestPick.teamId).get();
    const team = teamSnap.data();

    if (!team) {
      console.error('Team not found:', latestPick.teamId);
      return null;
    }

    // Fetch all teams to determine who's up next
    const teamsSnap = await admin.firestore().collection('teams')
      .where('leagueId', '==', afterData.leagueId)
      .get();

    const teams = teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Determine next pick owner
    const currentPickNum = afterData.currentPick?.overallPick || 0;
    const nextPickNum = currentPickNum + 1;
    const nextPick = afterPicks.find(p => p.overallPick === nextPickNum);

    let nextTeamName = 'TBD';
    let nextTeamMention = '';
    if (nextPick) {
      const nextTeam = teams.find(t => t.id === nextPick.teamId);
      nextTeamName = nextTeam?.name || 'Unknown Team';

      // If team has Telegram username, create a mention tag
      if (nextTeam?.telegramUsername) {
        // Format: @username (ensures it starts with @)
        const username = nextTeam.telegramUsername.startsWith('@')
          ? nextTeam.telegramUsername
          : `@${nextTeam.telegramUsername}`;
        nextTeamMention = ` ${username}`;
      }
    }

    // Build Telegram message
    const message = `
*DRAFT PICK*

*Pick ${latestPick.overallPick}* (Round ${latestPick.round}, Pick ${latestPick.pickInRound})

*${team.name}* selects:
*${player.name}* - ${player.position}
${player.nbaTeam} | $${player.salary}M

*Up Next:* ${nextTeamName}${nextTeamMention}
    `.trim();

    // Send to all chat IDs
    const chatIdArray = chatIds.split(',').map(id => id.trim());

    const promises = chatIdArray.map(async (chatId) => {
      try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'Markdown',
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          console.error(`Telegram API error for chat ${chatId}:`, error);
        } else {
          console.log(`Telegram notification sent to chat ${chatId}`);
        }
      } catch (error) {
        console.error(`Failed to send Telegram message to chat ${chatId}:`, error);
      }
    });

    await Promise.all(promises);

    console.log(`Draft pick notification sent for pick ${latestPick.overallPick}`);
    return null;
});

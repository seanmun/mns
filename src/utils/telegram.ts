/**
 * Sends a message to Telegram chat(s) via the bot API
 * Supports sending to multiple chat IDs (comma-separated in env)
 */
export async function sendTelegramMessage(message: string): Promise<void> {
  const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
  const chatIds = import.meta.env.VITE_TELEGRAM_CHAT_ID;

  if (!botToken || !chatIds) {
    console.warn('Telegram bot credentials not configured');
    return;
  }

  // Split chat IDs by comma and trim whitespace
  const chatIdArray = chatIds.split(',').map((id: string) => id.trim());

  // Send to all chat IDs
  const promises = chatIdArray.map(async (chatId: string) => {
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
      }
    } catch (error) {
      console.error(`Failed to send Telegram message to chat ${chatId}:`, error);
    }
  });

  await Promise.all(promises);
}

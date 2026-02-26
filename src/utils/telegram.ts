/**
 * Sends a message to Telegram via Supabase Edge Function.
 * Tokens are stored server-side — never exposed in the client bundle.
 */
export async function sendTelegramMessage(
  message: string,
  botType: 'draft' | 'alert' = 'draft',
  chatId?: string
): Promise<void> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials not configured');
    return;
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-telegram`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ message, botType, ...(chatId && { chatId }) }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Telegram Edge Function error:', error);
    }
  } catch (error) {
    console.error('Failed to send Telegram message:', error);
  }
}

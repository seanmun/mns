import { supabase } from './supabase';

interface SendEmailParams {
  template: string;
  to: string[];
  data: Record<string, string>;
}

/**
 * Send a notification email via the send-email edge function.
 * Fire-and-forget — failures are logged but never block the UI.
 */
export async function sendNotificationEmail(params: SendEmailParams): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('send-email', {
      body: params,
    });
    if (error) {
      console.error('Email send error:', error);
    }
  } catch (err) {
    console.error('Failed to send notification email:', err);
  }
}

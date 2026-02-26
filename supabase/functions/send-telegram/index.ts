import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TelegramRequest {
  message: string;
  botType: "draft" | "alert";
  chatId?: string; // Per-league override for draft bot notifications
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { message, botType, chatId }: TelegramRequest = await req.json();

    if (!message || !botType) {
      return new Response(
        JSON.stringify({ error: "message and botType are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Each bot has its own token and chat ID(s)
    const botToken =
      botType === "draft"
        ? Deno.env.get("TELEGRAM_BOT_TOKEN")
        : Deno.env.get("TELEGRAM_ALERTBOT_TOKEN");

    // For draft bot: use per-league chatId if provided, otherwise fall back to env var
    const chatIds =
      botType === "draft" && chatId
        ? chatId
        : botType === "draft"
          ? Deno.env.get("TELEGRAM_DRAFT_CHAT_ID")
          : Deno.env.get("TELEGRAM_ALERT_CHAT_ID");

    if (!botToken || !chatIds) {
      console.error(
        `Telegram credentials not configured for botType: ${botType}. ` +
        `Token: ${botToken ? "set" : "missing"}, ChatID: ${chatIds ? "set" : "missing"}`
      );
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const chatIdArray = chatIds.split(",").map((id: string) => id.trim());

    const results = await Promise.allSettled(
      chatIdArray.map(async (chatId: string) => {
        const response = await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: message,
              parse_mode: "Markdown",
            }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          console.error(`Telegram API error for chat ${chatId}:`, error);
          throw new Error(`Telegram API error: ${JSON.stringify(error)}`);
        }

        return response.json();
      })
    );

    const failed = results.filter((r) => r.status === "rejected").length;

    return new Response(
      JSON.stringify({
        success: failed === 0,
        sent: chatIdArray.length - failed,
        failed,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in send-telegram function:", error);
    return new Response(
      JSON.stringify({ error: `Failed to send message: ${error.message}` }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

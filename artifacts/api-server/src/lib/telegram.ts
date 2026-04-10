const BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"];
const CHAT_ID = process.env["TELEGRAM_CHAT_ID"];

function escape(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, (c) => "\\" + c);
}

export async function sendTelegramMessage(text: string): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) return;
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: "MarkdownV2",
      }),
    });
  } catch {
    // Silently ignore Telegram errors
  }
}

export function formatMailMessage(opts: {
  toEmail: string;
  fromAddr: string;
  subject: string;
  preview: string;
}): string {
  const { toEmail, fromAddr, subject, preview } = opts;
  const lines = [
    `📬 *New Email Received*`,
    ``,
    `*To:* ${escape(toEmail)}`,
    `*From:* ${escape(fromAddr)}`,
    `*Subject:* ${escape(subject || "(No Subject)")}`,
    ``,
    escape(preview ? preview.slice(0, 300) : "(No preview)"),
  ];
  return lines.join("\n");
}

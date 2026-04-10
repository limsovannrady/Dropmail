import { Router, type IRouter } from "express";
import { sendTelegramMessage, formatMailMessage } from "../lib/telegram";

const router: IRouter = Router();

router.post("/notify", async (req, res): Promise<void> => {
  const { toEmail, fromAddr, subject, preview } = req.body as {
    toEmail?: string;
    fromAddr?: string;
    subject?: string;
    preview?: string;
  };

  if (!toEmail || !fromAddr) {
    res.status(400).json({ error: "toEmail and fromAddr are required" });
    return;
  }

  const msg = formatMailMessage({
    toEmail,
    fromAddr,
    subject: subject || "",
    preview: preview || "",
  });

  await sendTelegramMessage(msg);
  res.json({ ok: true });
});

export default router;

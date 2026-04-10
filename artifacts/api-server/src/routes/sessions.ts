import { Router, type IRouter } from "express";
import { graphqlRequest, queries } from "../lib/dropmail";
import { registerSession } from "../lib/mailWatcher";
import {
  GetSessionParams,
  GetSessionMailsParams,
  GetMailContentParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

interface DropMailSession {
  introduceSession: {
    id: string;
    expiresAt: string;
    addresses: Array<{ address: string }>;
  };
}

interface DropMailMail {
  id: string;
  fromAddr: string;
  toAddr: string;
  downloadUrl?: string;
  text?: string;
  headerSubject: string;
  receivedAt: string;
  html?: string;
}

interface DropMailGetSession {
  session: {
    id: string;
    expiresAt: string;
    addresses: Array<{ address: string }>;
    mails: DropMailMail[];
  } | null;
}

function mapMail(m: DropMailMail) {
  return {
    rawId: m.id,
    fromAddr: m.fromAddr,
    toAddr: m.toAddr,
    downloadUrl: m.downloadUrl,
    text: m.text,
    headerSubject: m.headerSubject,
    receivedAt: m.receivedAt,
    html: m.html,
  };
}

router.post("/sessions", async (req, res): Promise<void> => {
  const data = await graphqlRequest<DropMailSession>(queries.introduceSession);
  const session = data.introduceSession;
  res.json({
    id: session.id,
    expiresAt: session.expiresAt,
    addresses: session.addresses,
  });
});

router.get("/sessions/:sessionId", async (req, res): Promise<void> => {
  const params = GetSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const raw = Array.isArray(req.params.sessionId)
    ? req.params.sessionId[0]
    : req.params.sessionId;

  const data = await graphqlRequest<DropMailGetSession>(queries.getSession, {
    id: raw,
  });

  if (!data.session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.json({
    id: data.session.id,
    expiresAt: data.session.expiresAt,
    addresses: data.session.addresses,
    mails: data.session.mails.map(mapMail),
  });
});

router.get(
  "/sessions/:sessionId/mails",
  async (req, res): Promise<void> => {
    const params = GetSessionMailsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const raw = Array.isArray(req.params.sessionId)
      ? req.params.sessionId[0]
      : req.params.sessionId;

    const data = await graphqlRequest<DropMailGetSession>(queries.getSession, {
      id: raw,
    });

    if (!data.session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    res.json({ mails: data.session.mails.map(mapMail) });
  },
);

router.get(
  "/sessions/:sessionId/mails/:mailId",
  async (req, res): Promise<void> => {
    const params = GetMailContentParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const sessionId = Array.isArray(req.params.sessionId)
      ? req.params.sessionId[0]
      : req.params.sessionId;
    const mailId = Array.isArray(req.params.mailId)
      ? req.params.mailId[0]
      : req.params.mailId;

    const data = await graphqlRequest<DropMailGetSession>(
      queries.getMailContent,
      { id: sessionId },
    );

    if (!data.session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const mail = data.session.mails.find((m) => m.id === mailId);
    if (!mail) {
      res.status(404).json({ error: "Mail not found" });
      return;
    }

    res.json(mapMail(mail));
  },
);

export default router;

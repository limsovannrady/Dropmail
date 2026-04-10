import { graphqlRequest, queries } from "./dropmail";
import { sendTelegramMessage, formatMailMessage } from "./telegram";
import { logger } from "./logger";

interface DropMailMail {
  id: string;
  fromAddr: string;
  toAddr: string;
  text?: string;
  headerSubject: string;
  receivedAt: string;
}

interface WatchedSession {
  id: string;
  email: string;
  knownMailIds: Set<string>;
  seeded: boolean;
}

const sessions = new Map<string, WatchedSession>();
let pollerHandle: ReturnType<typeof setInterval> | null = null;

export function registerSession(sessionId: string, email: string): void {
  if (sessions.has(sessionId)) return;
  sessions.set(sessionId, {
    id: sessionId,
    email,
    knownMailIds: new Set(),
    seeded: false,
  });
}

export function unregisterSession(sessionId: string): void {
  sessions.delete(sessionId);
}

async function pollSession(session: WatchedSession): Promise<void> {
  try {
    const data = await graphqlRequest<{
      session: { mails: DropMailMail[] } | null;
    }>(queries.getSession, { id: session.id });

    if (!data.session) return;

    const mails = data.session.mails;

    if (!session.seeded) {
      mails.forEach((m) => session.knownMailIds.add(m.id));
      session.seeded = true;
      return;
    }

    for (const mail of mails) {
      if (!session.knownMailIds.has(mail.id)) {
        session.knownMailIds.add(mail.id);
        const msg = formatMailMessage({
          toEmail: session.email,
          fromAddr: mail.fromAddr,
          subject: mail.headerSubject,
          preview: mail.text || "",
        });
        await sendTelegramMessage(msg);
        logger.info({ sessionId: session.id, mailId: mail.id }, "Forwarded mail to Telegram");
      }
    }
  } catch {
    // Ignore per-session poll errors
  }
}

async function pollAll(): Promise<void> {
  const entries = Array.from(sessions.values());
  await Promise.all(entries.map(pollSession));
}

export function startMailWatcher(intervalMs = 5000): void {
  if (pollerHandle) return;
  pollerHandle = setInterval(() => {
    pollAll().catch(() => {});
  }, intervalMs);
  logger.info({ intervalMs }, "Mail watcher started");
}

export function stopMailWatcher(): void {
  if (pollerHandle) {
    clearInterval(pollerHandle);
    pollerHandle = null;
  }
}

import { useState, useEffect, useCallback, useRef } from "react";
import { format, differenceInSeconds, formatDistanceToNow } from "date-fns";
import { Copy, RefreshCcw, Mail, CheckCircle2, Inbox, Loader2, History, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useCreateSession,
  useGetSession,
  getGetSessionQueryKey,
  useGetSessionMails,
  getGetSessionMailsQueryKey,
  getGetSessionMailsQueryOptions,
  useGetMailContent,
  getGetMailContentQueryKey
} from "@workspace/api-client-react";
import { useQueryClient, useQueries } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const SESSION_STORAGE_KEY = "dropmail_session_id";
const SESSION_HISTORY_KEY = "dropmail_session_history";

interface SavedSession {
  id: string;
  email: string;
  expiresAt: string;
  savedAt: string;
}

function getHistory(): SavedSession[] {
  try {
    const all: SavedSession[] = JSON.parse(localStorage.getItem(SESSION_HISTORY_KEY) || "[]");
    const active = all.filter((s) => !isExpired(s.expiresAt));
    if (active.length !== all.length) {
      localStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(active));
    }
    return active;
  } catch {
    return [];
  }
}

function saveToHistory(session: SavedSession) {
  const history = getHistory().filter((s) => s.id !== session.id);
  history.unshift(session);
  localStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
}

function removeFromHistory(id: string) {
  const history = getHistory().filter((s) => s.id !== id);
  localStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(history));
}

function isExpired(expiresAt: string) {
  return new Date(expiresAt) < new Date();
}

function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    const updateTimer = () => {
      const seconds = differenceInSeconds(new Date(expiresAt), new Date());
      setTimeLeft(Math.max(0, seconds));
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (timeLeft === null) return <span>--:--</span>;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isExpiringSoon = timeLeft < 300;

  return (
    <span className={`font-mono font-bold ${isExpiringSoon ? "text-destructive animate-pulse" : "text-primary"}`}>
      {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
    </span>
  );
}

function MailDetailView({ sessionId, mailId, onBack }: { sessionId: string; mailId: string; onBack: () => void }) {
  const { data: mail, isLoading } = useGetMailContent(sessionId, mailId, {
    query: {
      enabled: !!sessionId && !!mailId,
      queryKey: getGetMailContentQueryKey(sessionId, mailId),
    },
  });

  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (mail?.html && iframeRef.current) {
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(mail.html);
        doc.close();
      }
    }
  }, [mail?.html]);

  if (isLoading || !mail) {
    return (
      <div className="flex flex-col h-full space-y-4">
        <div className="flex items-center space-x-4 mb-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
          </div>
        </div>
        <Skeleton className="h-full w-full rounded-md" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Inbox
        </Button>
        <span className="text-xs text-muted-foreground font-mono">
          {format(new Date(mail.receivedAt), "MMM d, yyyy HH:mm:ss")}
        </span>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm flex flex-col flex-1">
        <div className="p-5 border-b border-border bg-muted/20">
          <h2 className="text-xl font-bold text-foreground mb-3">{mail.headerSubject || "No Subject"}</h2>
          <div className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
            <span className="text-muted-foreground font-medium">From:</span>
            <span className="font-mono text-foreground break-all">{mail.fromAddr}</span>
            <span className="text-muted-foreground font-medium">To:</span>
            <span className="font-mono text-foreground break-all">{mail.toAddr}</span>
          </div>
        </div>
        <div className="p-0 flex-1 relative min-h-[400px] bg-white rounded-b-xl overflow-hidden">
          {mail.html ? (
            <iframe
              ref={iframeRef}
              title="Email content"
              className="w-full h-full absolute inset-0 border-0"
              sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
            />
          ) : (
            <div className="p-6 h-full overflow-y-auto terminal-scroll text-gray-800 font-mono text-sm whitespace-pre-wrap">
              {mail.text || "This email has no text content."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [sessionId, setSessionId] = useState<string | null>(() => localStorage.getItem(SESSION_STORAGE_KEY));
  const [selectedMailId, setSelectedMailId] = useState<string | null>(null);
  const [selectedMailSession, setSelectedMailSession] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [history, setHistory] = useState<SavedSession[]>(getHistory);
  const [activeTab, setActiveTab] = useState("inbox");

  const createSession = useCreateSession();

  const { data: sessionData, isLoading: isLoadingSession, error: sessionError } = useGetSession(
    sessionId || "",
    {
      query: {
        enabled: !!sessionId,
        queryKey: getGetSessionQueryKey(sessionId || ""),
        retry: false,
      },
    }
  );

  const { isFetching: isPollingMails } = useGetSessionMails(
    sessionId || "",
    {
      query: {
        enabled: !!sessionId && !!sessionData,
        queryKey: getGetSessionMailsQueryKey(sessionId || ""),
        refetchInterval: 4000,
      },
    }
  );

  // Fetch mails from ALL sessions in history for unified inbox
  const allSessionMailsResults = useQueries({
    queries: history.map((s) => ({
      ...getGetSessionMailsQueryOptions(s.id),
      refetchInterval: 4000,
      queryKey: getGetSessionMailsQueryKey(s.id),
    })),
  });

  // Combine all mails from all sessions, tagged with session info
  const unifiedMails = allSessionMailsResults
    .flatMap((result, i) => {
      const session = history[i];
      return (result.data?.mails || []).map((mail) => ({
        ...mail,
        _sessionId: session.id,
        _sessionEmail: session.email,
      }));
    })
    .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());

  // Save current session to history when loaded
  useEffect(() => {
    if (sessionData) {
      const email = sessionData.addresses?.[0]?.address;
      if (email) {
        const saved: SavedSession = {
          id: sessionData.id,
          email,
          expiresAt: sessionData.expiresAt,
          savedAt: new Date().toISOString(),
        };
        saveToHistory(saved);
        setHistory(getHistory());
      }
    }
  }, [sessionData]);

  const doCreateSession = useCallback(() => {
    createSession.mutate(undefined, {
      onSuccess: (data) => {
        setSessionId(data.id);
        localStorage.setItem(SESSION_STORAGE_KEY, data.id);
        setSelectedMailId(null);
        setSelectedMailSession(null);
        setActiveTab("inbox");
        queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey(data.id) });
        queryClient.invalidateQueries({ queryKey: getGetSessionMailsQueryKey(data.id) });
        toast({ title: "New email created!", description: "Your new temporary inbox is ready." });
      },
      onError: () => {
        toast({ title: "Failed to create email", description: "Please try again.", variant: "destructive" });
      },
    });
  }, [createSession, queryClient, toast]);

  // Auto-refresh session when it expires
  useEffect(() => {
    if (!sessionData?.expiresAt) return;
    const msLeft = new Date(sessionData.expiresAt).getTime() - Date.now();
    if (msLeft <= 0) return;
    const timer = setTimeout(() => {
      createSession.mutate(undefined, {
        onSuccess: (data) => {
          setSessionId(data.id);
          localStorage.setItem(SESSION_STORAGE_KEY, data.id);
          setSelectedMailId(null);
        },
      });
    }, msLeft);
    return () => clearTimeout(timer);
  }, [sessionData?.expiresAt]);

  // Clear invalid session on error — just reset so user can retry
  useEffect(() => {
    if (sessionError) {
      setSessionId(null);
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, [sessionError]);

  const handleCreateSession = useCallback(() => {
    doCreateSession();
  }, [doCreateSession]);

  const handleDeleteHistory = useCallback((id: string) => {
    removeFromHistory(id);
    setHistory(getHistory());
  }, []);

  const handleCopyEmail = useCallback((email: string) => {
    navigator.clipboard.writeText(email);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }, []);

  const handleManualRefresh = useCallback(() => {
    history.forEach((s) => {
      queryClient.invalidateQueries({ queryKey: getGetSessionMailsQueryKey(s.id) });
    });
  }, [history, queryClient]);

  const activeEmail = sessionData?.addresses?.[0]?.address;
  const mails = unifiedMails;

  return (
    <div className="h-dvh bg-background text-foreground flex flex-col font-sans overflow-hidden">

      {/* HEADER */}
      <header className="shrink-0 bg-white border-b border-border z-10">
        <div className="w-full px-4 h-14 flex items-center justify-between gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
            <Mail className="w-4 h-4" />
          </div>
          {sessionData && activeEmail && (
            <button
              onClick={() => handleCopyEmail(activeEmail)}
              className="flex-1 flex items-center gap-2 bg-muted/60 rounded-xl px-3 py-2 min-w-0 active:bg-muted"
            >
              <code className="text-sm font-semibold truncate flex-1 text-left">{activeEmail}</code>
              {isCopied
                ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                : <Copy className="h-4 w-4 text-muted-foreground shrink-0" />}
            </button>
          )}
          <Button
            size="sm"
            onClick={handleCreateSession}
            disabled={createSession.isPending}
            className="gap-1.5 shrink-0 h-9 px-3"
          >
            {createSession.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            New
          </Button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {!sessionId ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Inbox className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Get a temporary email</h2>
                <p className="text-sm text-muted-foreground">Tap <span className="font-medium text-foreground">New</span> above to get started.</p>
              </div>
            </div>
          </div>
        ) : isLoadingSession ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm">Loading...</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col pb-16">

            {/* INBOX TAB */}
            {activeTab === "inbox" && (
              <div className="flex-1 overflow-hidden flex flex-col">
                {selectedMailId ? (
                  <div className="flex-1 overflow-y-auto p-4">
                    <MailDetailView
                      sessionId={selectedMailSession || sessionId}
                      mailId={selectedMailId}
                      onBack={() => { setSelectedMailId(null); setSelectedMailSession(null); }}
                    />
                  </div>
                ) : (
                  <>
                    <div className="shrink-0 px-4 py-2.5 border-b border-border flex items-center justify-between bg-muted/20">
                      <span className="text-sm font-semibold text-foreground">Inbox</span>
                      <button
                        onClick={handleManualRefresh}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground active:text-foreground py-1 px-2"
                        data-testid="button-refresh"
                      >
                        <RefreshCcw className={`h-3.5 w-3.5 ${isPollingMails ? "animate-spin text-primary" : ""}`} />
                        Refresh
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      {mails.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                          <RefreshCcw className="w-8 h-8 text-muted-foreground/30 animate-spin mb-3" style={{ animationDuration: "3s" }} />
                          <p className="font-medium text-foreground text-sm">Waiting for emails</p>
                          <p className="text-xs text-muted-foreground mt-1">Emails will appear here automatically.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-border">
                          {mails.map((mail) => (
                            <button
                              key={`${mail._sessionId}-${mail.rawId}`}
                              onClick={() => { setSelectedMailId(mail.rawId); setSelectedMailSession(mail._sessionId); }}
                              className="w-full text-left px-4 py-4 active:bg-muted/40 transition-colors"
                              data-testid={`button-mail-${mail.rawId}`}
                            >
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="font-semibold text-sm truncate">{mail.fromAddr}</span>
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {formatDistanceToNow(new Date(mail.receivedAt), { addSuffix: true })}
                                </span>
                              </div>
                              <p className="text-sm font-medium text-foreground/90 mb-0.5 truncate">{mail.headerSubject || "(No Subject)"}</p>
                              <p className="text-xs text-muted-foreground line-clamp-1">{mail.text || "No preview..."}</p>
                              <p className="text-xs text-primary/60 mt-1 truncate">→ {mail._sessionEmail}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* MANAGEMENT TAB */}
            {activeTab === "manage" && (
              <div className="flex-1 overflow-y-auto">
                <div className="px-4 py-2.5 border-b border-border bg-muted/20 flex items-center justify-between">
                  <span className="text-sm font-semibold">Management</span>
                  <span className="text-xs text-muted-foreground">{history.length} email(s)</span>
                </div>
                {history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                    <History className="w-10 h-10 mb-3 text-muted-foreground/30" />
                    <p className="font-medium text-sm">No emails yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Emails you create will appear here.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {history.map((saved) => {
                      const expired = isExpired(saved.expiresAt);
                      const isCurrent = saved.id === sessionId;
                      return (
                        <div key={saved.id} className="px-4 py-4 flex items-center gap-3" data-testid={`row-session-${saved.id}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              {isCurrent && <Badge variant="default" className="text-[10px] h-4 px-1.5 shrink-0">Active</Badge>}
                              {expired && !isCurrent && <Badge variant="secondary" className="text-[10px] h-4 px-1.5 shrink-0">Expired</Badge>}
                            </div>
                            <code className="text-sm font-medium text-foreground break-all leading-snug">{saved.email}</code>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleCopyEmail(saved.email)}
                              className="h-9 w-9 flex items-center justify-center text-muted-foreground active:text-foreground"
                              data-testid={`button-copy-${saved.id}`}
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteHistory(saved.id)}
                              className="h-9 w-9 flex items-center justify-center text-muted-foreground active:text-destructive"
                              data-testid={`button-delete-${saved.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </main>

      {/* BOTTOM TAB BAR — only when session active */}
      {sessionId && !isLoadingSession && (
        <div className="shrink-0 fixed bottom-0 left-0 right-0 bg-white border-t border-border z-20 flex">
          <button
            onClick={() => setActiveTab("inbox")}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium transition-colors ${activeTab === "inbox" ? "text-primary border-t-2 border-primary -mt-px" : "text-muted-foreground"}`}
            data-testid="tab-inbox"
          >
            <Inbox className="w-5 h-5" />
            <span className="flex items-center gap-1">
              Inbox
              {mails.length > 0 && <span className="bg-primary text-primary-foreground text-[10px] px-1.5 rounded-full">{mails.length}</span>}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("manage")}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium transition-colors ${activeTab === "manage" ? "text-primary border-t-2 border-primary -mt-px" : "text-muted-foreground"}`}
            data-testid="tab-manage"
          >
            <History className="w-5 h-5" />
            <span>Management</span>
          </button>
        </div>
      )}

    </div>
  );
}

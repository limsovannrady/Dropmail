import { useState, useEffect, useCallback, useRef } from "react";
import { format, differenceInSeconds, formatDistanceToNow } from "date-fns";
import { Copy, RefreshCcw, Mail, Clock, CheckCircle2, Inbox, ArrowLeft, Loader2, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  useCreateSession, 
  useGetSession, 
  getGetSessionQueryKey,
  useGetSessionMails,
  getGetSessionMailsQueryKey,
  useGetMailContent,
  getGetMailContentQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const SESSION_STORAGE_KEY = "dropmail_session_id";

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
  
  const isExpiringSoon = timeLeft < 300; // Less than 5 minutes

  return (
    <span className={`font-mono font-bold ${isExpiringSoon ? 'text-destructive animate-pulse' : 'text-primary'}`}>
      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </span>
  );
}

function MailDetailView({ sessionId, mailId, onBack }: { sessionId: string, mailId: string, onBack: () => void }) {
  const { data: mail, isLoading } = useGetMailContent(sessionId, mailId, {
    query: {
      enabled: !!sessionId && !!mailId,
      queryKey: getGetMailContentQueryKey(sessionId, mailId)
    }
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
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Inbox
        </Button>
        <span className="text-xs text-muted-foreground font-mono">
          {format(new Date(mail.receivedAt), "MMM d, yyyy HH:mm:ss")}
        </span>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm flex flex-col flex-1">
        <div className="p-6 border-b border-border bg-muted/20">
          <h2 className="text-2xl font-bold text-foreground mb-4">{mail.headerSubject || "No Subject"}</h2>
          <div className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
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
              className="w-full h-full absolute inset-0 border-0 text-black"
              sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
            />
          ) : (
            <div className="p-6 h-full overflow-y-auto terminal-scroll text-black font-mono text-sm whitespace-pre-wrap">
              {mail.text || "This email has no text content."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [sessionId, setSessionId] = useState<string | null>(() => {
    return localStorage.getItem(SESSION_STORAGE_KEY);
  });
  
  const [selectedMailId, setSelectedMailId] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const createSession = useCreateSession();
  
  const { data: sessionData, isLoading: isLoadingSession, error: sessionError } = useGetSession(
    sessionId || "", 
    { 
      query: { 
        enabled: !!sessionId,
        queryKey: getGetSessionQueryKey(sessionId || ""),
        retry: false
      } 
    }
  );

  const { data: mailsData, isFetching: isPollingMails } = useGetSessionMails(
    sessionId || "",
    {
      query: {
        enabled: !!sessionId && !!sessionData,
        queryKey: getGetSessionMailsQueryKey(sessionId || ""),
        refetchInterval: 4000, // Auto-poll every 4 seconds
      }
    }
  );

  // Clear invalid session
  useEffect(() => {
    if (sessionError) {
      setSessionId(null);
      localStorage.removeItem(SESSION_STORAGE_KEY);
      toast({
        title: "Session expired",
        description: "Your previous temporary email session has expired.",
        variant: "destructive"
      });
    }
  }, [sessionError, toast]);

  const handleCreateSession = useCallback(() => {
    createSession.mutate(undefined, {
      onSuccess: (data) => {
        setSessionId(data.id);
        localStorage.setItem(SESSION_STORAGE_KEY, data.id);
        setSelectedMailId(null);
        toast({
          title: "Session Created",
          description: "Your new temporary email is ready.",
        });
      },
      onError: () => {
        toast({
          title: "Failed to create session",
          description: "Please try again later.",
          variant: "destructive"
        });
      }
    });
  }, [createSession, toast]);

  const handleCopyEmail = useCallback((email: string) => {
    navigator.clipboard.writeText(email);
    setIsCopied(true);
    toast({
      title: "Copied to clipboard",
      description: "Email address copied to your clipboard.",
    });
    setTimeout(() => setIsCopied(false), 2000);
  }, [toast]);

  const handleManualRefresh = useCallback(() => {
    if (sessionId) {
      queryClient.invalidateQueries({ queryKey: getGetSessionMailsQueryKey(sessionId) });
    }
  }, [sessionId, queryClient]);

  const activeEmail = sessionData?.addresses?.[0]?.address;
  const mails = mailsData?.mails || sessionData?.mails || [];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/30">
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center border border-primary/30 shadow-[0_0_15px_rgba(139,92,246,0.3)]">
              <Mail className="w-4 h-4" />
            </div>
            <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">DropMail</span>
          </div>
          
          {sessionData && (
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-full border border-border/50">
                <Clock className="w-4 h-4" />
                <span>Expires in:</span>
                <CountdownTimer expiresAt={sessionData.expiresAt} />
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCreateSession}
                disabled={createSession.isPending}
                className="border-primary/20 hover:border-primary/50 hover:bg-primary/10 transition-all"
              >
                <KeyRound className="w-4 h-4 mr-2" />
                New Session
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 container max-w-6xl mx-auto px-4 py-8 flex flex-col">
        {!sessionId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in-95 duration-500">
              <div className="mx-auto w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shadow-[0_0_40px_rgba(139,92,246,0.15)]">
                <Inbox className="w-10 h-10 text-primary" />
              </div>
              <div className="space-y-3">
                <h1 className="text-4xl font-bold tracking-tight text-foreground">Disposable Inbox</h1>
                <p className="text-lg text-muted-foreground">
                  Generate a temporary, secure email address instantly. Use it once, protect your privacy forever.
                </p>
              </div>
              <Button 
                size="lg" 
                className="w-full text-lg h-14 shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:shadow-[0_0_30px_rgba(139,92,246,0.6)] transition-all font-semibold rounded-xl"
                onClick={handleCreateSession}
                disabled={createSession.isPending}
              >
                {createSession.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Email Address"
                )}
              </Button>
            </div>
          </div>
        ) : isLoadingSession ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="font-mono text-sm animate-pulse">Initializing secure session...</p>
            </div>
          </div>
        ) : sessionData && activeEmail ? (
          <div className="flex flex-col h-full gap-8">
            
            {/* Address Header */}
            <Card className="border-primary/20 bg-card/40 backdrop-blur-sm overflow-hidden shadow-[0_4px_30px_rgba(0,0,0,0.1)] relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-transparent pointer-events-none" />
              <CardContent className="p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
                <div className="space-y-2 w-full sm:w-auto flex-1">
                  <p className="text-sm font-medium text-primary uppercase tracking-wider">Your Temporary Address</p>
                  <div className="flex items-center gap-3 w-full">
                    <code className="text-xl sm:text-3xl font-bold bg-muted/50 px-4 py-2 rounded-lg border border-border/50 flex-1 sm:flex-none truncate text-foreground select-all">
                      {activeEmail}
                    </code>
                    <Button 
                      size="icon" 
                      variant={isCopied ? "default" : "outline"} 
                      onClick={() => handleCopyEmail(activeEmail)}
                      className={`h-12 w-12 shrink-0 transition-all ${isCopied ? 'bg-green-500 hover:bg-green-600 text-white border-green-500' : 'hover:border-primary hover:text-primary hover:bg-primary/10'}`}
                    >
                      {isCopied ? <CheckCircle2 className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>
                
                <div className="sm:hidden flex items-center justify-between w-full text-sm text-muted-foreground bg-muted/30 px-4 py-2 rounded-lg border border-border/50">
                  <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> Expires in:</span>
                  <CountdownTimer expiresAt={sessionData.expiresAt} />
                </div>
              </CardContent>
            </Card>

            {/* Main Content Area */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr] gap-6 min-h-[500px]">
              {selectedMailId ? (
                <div className="h-full bg-card rounded-xl border border-border/50 p-4 shadow-sm">
                  <MailDetailView 
                    sessionId={sessionId} 
                    mailId={selectedMailId} 
                    onBack={() => setSelectedMailId(null)} 
                  />
                </div>
              ) : (
                <div className="flex flex-col bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-border flex items-center justify-between bg-muted/10">
                    <div className="flex items-center gap-2">
                      <Inbox className="w-5 h-5 text-primary" />
                      <h2 className="font-semibold text-lg">Inbox</h2>
                      <span className="bg-primary/20 text-primary text-xs font-bold px-2 py-0.5 rounded-full ml-2">
                        {mails.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {isPollingMails && <span className="text-xs text-primary font-mono animate-pulse hidden sm:inline-block">Polling...</span>}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleManualRefresh}
                        className="text-muted-foreground hover:text-primary hover:bg-primary/10"
                      >
                        <RefreshCcw className={`h-4 w-4 mr-2 ${isPollingMails ? 'animate-spin text-primary' : ''}`} />
                        Refresh
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto">
                    {mails.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground opacity-70">
                        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                          <RefreshCcw className="w-8 h-8 animate-spin-slow text-muted-foreground/50" style={{ animationDuration: '3s' }} />
                        </div>
                        <p className="text-lg font-medium text-foreground">Waiting for incoming emails</p>
                        <p className="max-w-xs mt-2 text-sm">Emails sent to your temporary address will appear here automatically.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/50">
                        {mails.map((mail) => (
                          <button
                            key={mail.rawId}
                            onClick={() => setSelectedMailId(mail.rawId)}
                            className="w-full text-left p-4 sm:p-5 hover:bg-muted/30 transition-colors focus:outline-none focus:bg-muted/50 group"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-2">
                              <span className="font-semibold text-foreground truncate max-w-[200px] sm:max-w-[300px]">
                                {mail.fromAddr}
                              </span>
                              <span className="text-xs text-muted-foreground font-mono shrink-0">
                                {formatDistanceToNow(new Date(mail.receivedAt), { addSuffix: true })}
                              </span>
                            </div>
                            <h3 className="font-medium text-foreground/90 text-base mb-1 group-hover:text-primary transition-colors">
                              {mail.headerSubject || "(No Subject)"}
                            </h3>
                            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                              {mail.text || "No preview available..."}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
          </div>
        ) : null}
      </main>
    </div>
  );
}

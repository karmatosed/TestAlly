import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getManualTestResults,
  pollJobStatus,
  postChatComponentTurn,
  submitAnalysis,
} from '../api';
import { ResultsPanel } from '../components/ResultsPanel';
import type { AnalyzeRequest, JobStatus, ManualTestResponse } from '../types/api';
import styles from './ChatWorkspace.module.css';

type LocalMessage = { id: string; role: 'user' | 'assistant'; content: string };

type AnalysisState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'complete'; results: ManualTestResponse }
  | { status: 'error'; message: string };

function toApiMessages(msgs: LocalMessage[]): { role: 'user' | 'assistant'; content: string }[] {
  return msgs.map(({ role, content }) => ({ role, content }));
}

function makeMessageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Third shell tab: conversational capture of component context (draft from LLM only), then analyze pipeline.
 */
export function ChatWorkspace() {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [draft, setDraft] = useState<Partial<AnalyzeRequest>>({ language: 'html' });
  const [composer, setComposer] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [analysisState, setAnalysisState] = useState<AnalysisState>({ status: 'idle' });
  const [progress, setProgress] = useState<JobStatus | null>(null);

  const messagesRef = useRef<LocalMessage[]>([]);
  const draftRef = useRef<Partial<AnalyzeRequest>>({ language: 'html' });
  const composerRef = useRef('');
  const sendingRef = useRef(false);

  messagesRef.current = messages;
  draftRef.current = draft;
  composerRef.current = composer;

  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = transcriptEndRef.current;
    el?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  const clearChat = useCallback(() => {
    setMessages([]);
    messagesRef.current = [];
    setDraft({ language: 'html' });
    draftRef.current = { language: 'html' };
    setComposer('');
    composerRef.current = '';
    setChatError(null);
    setAnalysisState({ status: 'idle' });
    setProgress(null);
  }, []);

  const sendMessage = useCallback(async () => {
    const text = composerRef.current.trim();
    if (!text || sendingRef.current) return;

    sendingRef.current = true;
    setSending(true);
    setChatError(null);

    const userMsg: LocalMessage = {
      id: makeMessageId(),
      role: 'user',
      content: text,
    };
    const history = [...messagesRef.current, userMsg];
    messagesRef.current = history;
    setMessages(history);
    setComposer('');
    composerRef.current = '';

    try {
      const res = await postChatComponentTurn({
        messages: toApiMessages(history),
        draft: draftRef.current,
      });
      const assistantMsg: LocalMessage = {
        id: makeMessageId(),
        role: 'assistant',
        content: res.assistantMessage,
      };
      const withAssistant = [...history, assistantMsg];
      messagesRef.current = withAssistant;
      setMessages(withAssistant);
      setDraft(res.draft);
      draftRef.current = res.draft;
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Chat request failed');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }, []);

  const onComposerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.nativeEvent.isComposing || e.key === 'Process') return;
      if (e.key !== 'Enter' || e.shiftKey) return;
      e.preventDefault();
      void sendMessage();
    },
    [sendMessage],
  );

  const runAnalysis = useCallback(async () => {
    const d = draftRef.current;
    const code = d.code?.trim();
    if (!code) return;

    setProgress(null);
    setAnalysisState({ status: 'running' });

    try {
      const response = await submitAnalysis({
        code,
        language: d.language ?? 'html',
        description: d.description?.trim() || undefined,
        css: d.css?.trim() || undefined,
        js: d.js?.trim() || undefined,
      });

      await pollJobStatus(response.jobId, (status) => {
        setProgress(status);
      });

      const results = await getManualTestResults(response.jobId);
      setAnalysisState({ status: 'complete', results });
    } catch (err) {
      setAnalysisState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Analysis failed',
      });
    }
  }, []);

  const canAnalyze = Boolean(draft.code?.trim());
  const analyzing = analysisState.status === 'running';

  return (
    <div className={styles.container}>
      <div className={styles.chatColumn}>
        <h2 className={styles.panelTitle}>Chat</h2>
        <p className={styles.hint}>Enter sends · Shift+Enter for a new line</p>

        <div
          className={styles.transcript}
          role="log"
          aria-label="Chat messages"
          aria-live="polite"
          aria-relevant="additions"
          tabIndex={0}
        >
          {messages.length === 0 && !sending && (
            <p className={styles.placeholder}>
              Describe your component or paste code. When the assistant has enough to analyze, use Run
              analysis.
            </p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`${styles.bubble} ${m.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant}`}
            >
              <span className={styles.bubbleRole}>{m.role === 'user' ? 'You' : 'Assistant'}</span>
              {m.content}
            </div>
          ))}
          <div ref={transcriptEndRef} />
        </div>

        <div className={styles.composerRow}>
          <label htmlFor="chat-composer" className={styles.visuallyHidden}>
            Message
          </label>
          <textarea
            id="chat-composer"
            className={styles.composer}
            value={composer}
            onChange={(e) => {
              composerRef.current = e.target.value;
              setComposer(e.target.value);
            }}
            onKeyDown={onComposerKeyDown}
            placeholder="Message the assistant…"
            disabled={sending}
            rows={4}
            spellCheck
          />
          {sending && (
            <p
              className={styles.sendingStatus}
              role="status"
              aria-live="polite"
              aria-label="Waiting for language model response"
            >
              Working…
            </p>
          )}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.sendButton}
              disabled={sending || !composer.trim()}
              onClick={() => void sendMessage()}
            >
              Send
            </button>
            <button type="button" className={styles.secondaryButton} onClick={clearChat}>
              Clear chat
            </button>
            <button
              type="button"
              className={styles.analyzeButton}
              disabled={!canAnalyze || analyzing || sending}
              onClick={() => void runAnalysis()}
            >
              {analyzing ? 'Analyzing…' : 'Run analysis'}
            </button>
          </div>
          <p className={styles.privacy}>
            Messages are sent to your configured LLM endpoint (see LLM_API_URL). Do not paste secrets.
          </p>
          {chatError && (
            <div className={styles.error} role="alert" aria-live="assertive">
              {chatError}
            </div>
          )}
        </div>
      </div>

      <div className={styles.resultsPanel}>
        <h2 className={styles.panelTitle}>Results</h2>

        {analysisState.status === 'idle' && !analyzing && (
          <p className={styles.resultsPlaceholder}>
            Run analysis after the assistant has filled in component code from your chat.
          </p>
        )}

        {analyzing && progress && (
          <div className={styles.progress}>
            <div className={styles.progressPhase}>{progress.phase}</div>
            <p>{progress.description}</p>
            {progress.phaseIndex !== undefined && progress.totalPhases !== undefined && (
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${(progress.phaseIndex / progress.totalPhases) * 100}%` }}
                />
              </div>
            )}
          </div>
        )}

        {analyzing && !progress && (
          <p className={styles.resultsPlaceholder}>Submitting job…</p>
        )}

        {analysisState.status === 'error' && (
          <div className={styles.error} role="alert">
            <strong>Error:</strong> {analysisState.message}
          </div>
        )}

        {analysisState.status === 'complete' &&
          analysisState.results.status === 'success' &&
          analysisState.results.analysis && (
            <div className={styles.results}>
              <ResultsPanel result={analysisState.results.analysis} />
            </div>
          )}
      </div>
    </div>
  );
}

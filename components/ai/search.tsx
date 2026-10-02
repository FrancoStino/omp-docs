'use client';
import {
    type ComponentProps,
    createContext,
    type ReactNode,
    type SyntheticEvent,
    use,
    useEffect,
    useEffectEvent,
    useMemo,
    useRef,
    useState,
} from 'react';
import {flushSync} from 'react-dom';
import {Loader2, MessageCircleIcon, Paperclip, Plus, RefreshCw, SearchIcon, Send, X} from 'lucide-react';
import {cn} from '../../lib/cn';
import {buttonVariants} from '../ui/button';
import {useChat, type UseChatHelpers} from '@ai-sdk/react';
import {DefaultChatTransport, type Tool, type UIMessage, type UIToolInvocation} from 'ai';
import {Markdown} from '../markdown';

export type ChatUIMessage = UIMessage<
    never,
    {
        client: {
            location: string;
        };
    }
>;

export type SearchTool = Tool<{ query: string; limit: number }>;

const SessionContext = createContext<{
    open: boolean;
    setOpen: (open: boolean) => void;
    sessionId: string;
    setSessionId: (id: string) => void;
} | null>(null);

const ChatContext = createContext<{
    chat: UseChatHelpers<ChatUIMessage>;
} | null>(null);

const StoragePrefix = 'omp-ai-session:';
const StorageIndex = 'omp-ai-sessions';

interface SessionMeta {
    id: string;
    title: string;
    createdAt: number;
}

function readIndex(): SessionMeta[] {
    try {
        return JSON.parse(localStorage.getItem(StorageIndex) ?? '[]');
    } catch {
        return [];
    }
}

function writeIndex(sessions: SessionMeta[]) {
    localStorage.setItem(StorageIndex, JSON.stringify(sessions));
}

function newSessionId(): string {
    return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** The session the chat opens on: the most recent one, or a fresh id. */
function currentSessionId(): string {
    if (typeof window === 'undefined') return 'search';
    const index = readIndex();
    if (index.length > 0) return index[0].id;
    const id = newSessionId();
    writeIndex([{id, title: 'New chat', createdAt: Date.now()}]);
    return id;
}

/** Restore messages written for a session id (or [] when none). */
function readSession(id: string): ChatUIMessage[] {
    try {
        const raw = localStorage.getItem(StoragePrefix + id);
        if (!raw) return [];
        return JSON.parse(raw) as ChatUIMessage[];
    } catch {
        return [];
    }
}

/** Persist messages after every chat update, and keep the index title in sync
 with the first user message. */
function usePersistSession(id: string, messages: ChatUIMessage[]) {
    useEffect(() => {
        try {
            localStorage.setItem(StoragePrefix + id, JSON.stringify(messages));
            const index = readIndex();
            const entry = index.find((s) => s.id === id);
            if (!entry) {
                writeIndex([{id, title: titleOf(messages), createdAt: Date.now()}, ...index]);
            } else if (entry.title === 'New chat' && messages.length > 0) {
                entry.title = titleOf(messages);
                writeIndex(index);
            }
        } catch {
            // private mode / quota: chat still works, it just won't persist
        }
    }, [id, messages]);
}

function titleOf(messages: ChatUIMessage[]): string {
    for (const m of messages) {
        if (m.role !== 'user') continue;
        for (const part of m.parts ?? []) {
            if (part.type === 'text' && part.text.trim().length > 0) {
                return part.text.trim().slice(0, 42) + (part.text.trim().length > 42 ? '…' : '');
            }
        }
    }
    return 'New chat';
}

export function AISearchPanelHeader({className, ...props}: ComponentProps<'div'>) {
    const {setOpen, chat, sessionId, setSessionId} = useAISearchContext();
    const [pickerOpen, setPickerOpen] = useState(false);
    const [sessions, setSessions] = useState<SessionMeta[]>(() => readIndex());
    const current = sessions.find((s) => s.id === sessionId) ?? {id: sessionId, title: 'New chat'};

    const refresh = () => setSessions(readIndex());

    const select = (id: string) => {
        setSessionId(id);
        refresh();
        setPickerOpen(false);
    };

    const createNew = () => {
        const id = newSessionId();
        writeIndex([{id, title: 'New chat', createdAt: Date.now()}, ...readIndex()]);
        chat.setMessages([]);
        select(id);
    };

    const remove = (id: string) => {
        localStorage.removeItem(StoragePrefix + id);
        const rest = readIndex().filter((s) => s.id !== id);
        writeIndex(rest);
        if (id === sessionId) {
            if (rest.length > 0) {
                setSessionId(rest[0].id);
            } else {
                createNew();
                return;
            }
        }
        refresh();
    };

    return (
        <div
            className={cn(
                'sticky top-0 flex items-start gap-2 border rounded-xl bg-fd-secondary text-fd-secondary-foreground shadow-sm',
                className,
            )}
            {...props}
        >
            <div className="px-3 py-2 flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium">AI Chat</p>
                    <button
                        type="button"
                        aria-label="Chat sessions"
                        title={`Session: ${current.title}`}
                        onClick={() => {
                            refresh();
                            setPickerOpen((v) => !v);
                        }}
                        className={cn(
                            buttonVariants({size: 'icon-xs', variant: 'ghost'}),
                            'text-fd-muted-foreground shrink-0',
                        )}
                    >
                        <MessageCircleIcon/>
                    </button>
                    <button
                        type="button"
                        aria-label="New chat"
                        title="New chat"
                        onClick={createNew}
                        className={cn(
                            buttonVariants({size: 'icon-xs', variant: 'ghost'}),
                            'text-fd-muted-foreground shrink-0',
                        )}
                    >
                        <Plus/>
                    </button>
                </div>
                <p className="text-xs text-fd-muted-foreground mt-1 truncate" title={current.title}>
                    {current.title}
                </p>
                {pickerOpen && (
                    <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border bg-fd-background p-1">
                        {sessions.length === 0 && (
                            <p className="px-2 py-1.5 text-xs text-fd-muted-foreground">No saved chats.</p>
                        )}
                        {sessions.map((s) => (
                            <div
                                key={s.id}
                                className={cn(
                                    'flex items-center gap-1 rounded-md px-2 py-1.5 text-xs',
                                    s.id === sessionId && 'bg-fd-accent',
                                )}
                            >
                                <button
                                    type="button"
                                    onClick={() => select(s.id)}
                                    className="min-w-0 flex-1 truncate text-start"
                                    title={s.title}
                                >
                                    {s.title}
                                </button>
                                <button
                                    type="button"
                                    aria-label={`Delete ${s.title}`}
                                    onClick={() => remove(s.id)}
                                    className="shrink-0 rounded p-0.5 text-fd-muted-foreground hover:text-fd-primary"
                                >
                                    <X className="size-3.5"/>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <button
                aria-label="Close"
                tabIndex={-1}
                className={cn(
                    buttonVariants({
                        size: 'icon-sm',
                        variant: 'ghost',
                        className: 'text-fd-muted-foreground rounded-full',
                    }),
                )}
                onClick={() => setOpen(false)}
            >
                <X/>
            </button>
        </div>
    );
}

export function AISearchInputActions() {
    const {messages, status, setMessages, regenerate} = useChatContext();
    const isLoading = status === 'streaming';

    if (messages.length === 0) return null;

    return (
        <>
            {!isLoading && messages.at(-1)?.role === 'assistant' && (
                <button
                    type="button"
                    className={cn(
                        buttonVariants({
                            variant: 'secondary',
                            size: 'sm',
                            className: 'rounded-full gap-1.5',
                        }),
                    )}
                    onClick={() => regenerate()}
                >
                    <RefreshCw className="size-4"/>
                    Retry
                </button>
            )}
            <button
                type="button"
                className={cn(
                    buttonVariants({
                        variant: 'secondary',
                        size: 'sm',
                        className: 'rounded-full',
                    }),
                )}
                onClick={() => setMessages([])}
            >
                Clear Chat
            </button>
        </>
    );
}

const StorageKeyInput = '__ai_search_input';

/** File -> data URL. Object URLs never reach the model: the SDK must
 serialise the payload, and blob: is not http/https/data. */
function fileToDataUrl(file: File): Promise<string> {
    const {promise, resolve, reject} = Promise.withResolvers<string>();
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
    return promise;
}

export function AISearchInput(props: ComponentProps<'form'>) {
    const {status, sendMessage, stop} = useChatContext();
    const [input, setInput] = useState(() => localStorage.getItem(StorageKeyInput) ?? '');
    const [files, setFiles] = useState<File[]>([]);
    const fileRef = useRef<HTMLInputElement>(null);
    const isLoading = status === 'streaming' || status === 'submitted';
    const onStart = async (e?: SyntheticEvent) => {
        e?.preventDefault();
        const message = input.trim();
        if (message.length === 0 && files.length === 0) return;

        // Cap total payload: a burst of screenshots would otherwise blow the request.
        const MAX_FILES = 4;
        const MAX_BYTES = 3 * 1024 * 1024;
        const picked = files.slice(0, MAX_FILES).filter((f) => f.size <= MAX_BYTES);

        const urls = await Promise.all(picked.map((f) => fileToDataUrl(f)));

        void sendMessage({
            role: 'user',
            parts: [
                {
                    type: 'data-client',
                    data: {
                        location: location.href,
                    },
                },
                ...picked.map((f, i) => ({
                    type: 'file' as const,
                    url: urls[i],
                    filename: f.name,
                    mediaType: f.type || 'application/octet-stream',
                })),
                ...(message.length > 0
                    ? [
                        {
                            type: 'text' as const,
                            text: message,
                        },
                    ]
                    : []),
            ],
        });
        setInput('');
        setFiles([]);
        localStorage.removeItem(StorageKeyInput);
    };

    useEffect(() => {
        if (isLoading) document.getElementById('nd-ai-input')?.focus();
    }, [isLoading]);

    return (
        <form {...props} className={cn('flex flex-col', props.className)} onSubmit={onStart}>
            <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                aria-hidden
                tabIndex={-1}
                className="hidden"
                onChange={(e) => {
                    setFiles(Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/')));
                    e.target.value = '';
                }}
            />
            {files.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-3 pt-2">
                    {files.map((f) => (
                        <button
                            key={`${f.name}-${f.size}`}
                            type="button"
                            onClick={() => setFiles((prev) => prev.filter((x) => x !== f))}
                            title={`${f.name} — click to remove`}
                            className="group relative size-12 overflow-hidden rounded-md border"
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={URL.createObjectURL(f)} alt={f.name} className="size-full object-cover"/>
                            <span
                                className="absolute inset-0 hidden items-center justify-center bg-black/60 group-hover:flex">
                                <X className="size-4 text-white"/>
                            </span>
                        </button>
                    ))}
                </div>
            )}
            <div className="flex items-start pe-2">
                <button
                    type="button"
                    aria-label="Attach images"
                    title="Attach images (needs a vision model)"
                    onClick={() => fileRef.current?.click()}
                    disabled={isLoading}
                    className={cn(
                        buttonVariants({variant: 'ghost', size: 'icon-xs'}),
                        'mt-2 shrink-0 text-fd-muted-foreground',
                        files.length > 0 && 'text-fd-primary',
                    )}
                >
                    <Paperclip/>
                </button>
                <Input
                    value={input}
                    placeholder={isLoading ? 'AI is answering...' : 'Ask a question, or paste text/images'}
                    autoFocus
                    className="p-3"
                    disabled={status === 'streaming' || status === 'submitted'}
                    onChange={(e) => {
                        setInput(e.target.value);
                        localStorage.setItem(StorageKeyInput, e.target.value);
                    }}
                    onPaste={(e) => {
                        const items = Array.from(e.clipboardData?.items ?? []);
                        const images = items.filter((i) => i.type.startsWith('image/'));
                        if (images.length === 0) return;
                        e.preventDefault();
                        const picked = images
                            .map((i) => i.getAsFile())
                            .filter((f): f is File => f != null);
                        setFiles((prev) => [...prev, ...picked]);
                        const text = e.clipboardData?.getData('text/plain') ?? '';
                        if (text.trim().length > 0) {
                            setInput((prev) => (prev.length > 0 ? `${prev}\n${text}` : text));
                        }
                    }}
                    onKeyDown={(event) => {
                        // keyCode 229: Safari fires `compositionend` before this keydown, `isComposing` is already false
                        if (event.nativeEvent.isComposing || event.keyCode === 229) return;
                        if (!event.shiftKey && event.key === 'Enter') {
                            onStart(event);
                        }
                    }}
                />
                {isLoading ? (
                    <button
                        key="bn"
                        type="button"
                        className={cn(
                            buttonVariants({
                                variant: 'secondary',
                                className: 'transition-all rounded-full mt-2 gap-2',
                            }),
                        )}
                        onClick={stop}
                    >
                        <Loader2 className="size-4 animate-spin text-fd-muted-foreground"/>
                        Abort Answer
                    </button>
                ) : (
                    <button
                        key="bn2"
                        type="submit"
                        disabled={input.length === 0 && files.length === 0}
                        className={cn(
                            buttonVariants({
                                variant: 'default',
                                className: 'transition-all rounded-full mt-2',
                            }),
                        )}
                    >
                        <Send className="size-4"/>
                    </button>
                )}
            </div>
        </form>
    );
}

function List(props: Omit<ComponentProps<'div'>, 'dir'>) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        function callback() {
            const container = containerRef.current;
            if (!container) return;

            container.scrollTo({
                top: container.scrollHeight,
                behavior: 'instant',
            });
        }

        const observer = new ResizeObserver(callback);
        callback();

        const element = containerRef.current?.firstElementChild;

        if (element) {
            observer.observe(element);
        }

        return () => {
            observer.disconnect();
        };
    }, []);

    return (
        <div
            ref={containerRef}
            {...props}
            className={cn('fd-scroll-container overflow-y-auto min-w-0 flex flex-col', props.className)}
        >
            {props.children}
        </div>
    );
}

function Input(props: ComponentProps<'textarea'>) {
    const ref = useRef<HTMLDivElement>(null);
    const shared = cn('col-start-1 row-start-1', props.className);

    return (
        <div className="grid flex-1">
      <textarea
          id="nd-ai-input"
          {...props}
          className={cn(
              'resize-none bg-transparent placeholder:text-fd-muted-foreground focus-visible:outline-none',
              shared,
          )}
      />
            <div ref={ref} className={cn(shared, 'break-all invisible')}>
                {`${props.value?.toString() ?? ''}\n`}
            </div>
        </div>
    );
}

const roleName: Record<string, string> = {
    user: 'you',
    assistant: 'omp',
};

/** One summary row for all search calls of a message. The model may call
 the tool up to 5 times per answer; rendering a box per call was the
 repeated `0/1/0 search results` noise in the chat. */
function SearchCallsSummary({calls}: { calls: UIToolInvocation<SearchTool>[] }) {
    if (calls.length === 0) return null;

    const failed = calls.find((c) => c.state === 'output-error' || c.state === 'output-denied');
    const pending = calls.some((c) => !c.output && !failed);
    if (failed) {
        return (
            <div
                className="flex flex-row gap-2 items-center mt-3 rounded-lg border bg-fd-secondary text-fd-muted-foreground text-xs p-2">
                <SearchIcon className="size-4"/>
                <p className="text-fd-error">{failed.errorText ?? 'Failed to search'}</p>
            </div>
        );
    }
    if (pending) {
        return (
            <div
                className="flex flex-row gap-2 items-center mt-3 rounded-lg border bg-fd-secondary text-fd-muted-foreground text-xs p-2">
                <SearchIcon className="size-4"/>
                <p>Searching…</p>
            </div>
        );
    }
    const total = calls.reduce(
        (n, c) => n + (Array.isArray(c.output) ? c.output.length : typeof c.output === 'string' ? 1 : 0),
        0,
    );
    return (
        <div
            className="flex flex-row gap-2 items-center mt-3 rounded-lg border bg-fd-secondary text-fd-muted-foreground text-xs p-2">
            <SearchIcon className="size-4"/>
            <p>{`${total} search result${total === 1 ? '' : 's'}`}</p>
        </div>
    );
}

function Message({message, ...props}: { message: ChatUIMessage } & ComponentProps<'div'>) {
    let markdown = '';
    const searchCalls: UIToolInvocation<SearchTool>[] = [];
    const attachments: { url: string; filename?: string; mediaType?: string }[] = [];

    for (const part of message.parts ?? []) {
        if (part.type === 'text') {
            markdown += part.text;
            continue;
        }

        if (part.type === 'file') {
            const f = part as unknown as { url?: string; filename?: string; mediaType?: string };
            if (typeof f.url === 'string') attachments.push({url: f.url, filename: f.filename, mediaType: f.mediaType});
            continue;
        }

        if (part.type.startsWith('tool-')) {
            const toolName = part.type.slice('tool-'.length);
            const p = part as UIToolInvocation<Tool>;

            if (toolName !== 'search' || !p.toolCallId) continue;
            searchCalls.push(p);
        }
    }

    return (
        <div onClick={(e) => e.stopPropagation()} {...props}>
            <p
                className={cn(
                    'mb-1 text-sm font-medium text-fd-muted-foreground',
                    message.role === 'assistant' && 'text-fd-primary',
                )}
            >
                {roleName[message.role] ?? 'unknown'}
            </p>
            <div className="prose text-sm">
                <Markdown text={markdown}/>
            </div>

            {attachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                    {attachments.map((a, i) =>
                        a.mediaType?.startsWith('image/') || /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(a.filename ?? '') ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                key={`${a.filename ?? 'file'}-${i}`}
                                src={a.url}
                                alt={a.filename ?? 'attached image'}
                                className="max-h-40 max-w-full rounded-lg border object-contain"
                            />
                        ) : (
                            <a
                                key={`${a.filename ?? 'file'}-${i}`}
                                href={a.url}
                                download={a.filename}
                                className="text-xs text-fd-primary underline"
                            >
                                {a.filename ?? 'attached file'}
                            </a>
                        ),
                    )}
                </div>
            )}

            <SearchCallsSummary calls={searchCalls}/>
        </div>
    );
}

export function AISearch({children}: { children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const [sessionId, setSessionId] = useState(() => currentSessionId());

    // One Inner (and one useChat instance) per session id: remounting on
    // change keeps the message list aligned with the selected session
    // instead of leaking messages from the previous one.
    return (
        <SessionContext value={useMemo(() => ({open, setOpen, sessionId, setSessionId}), [open, sessionId])}>
            <Inner key={sessionId} sessionId={sessionId}>
                {children}
            </Inner>
        </SessionContext>
    );
}

/** Owns the useChat instance for exactly one session. */
function Inner({children, sessionId}: { children: ReactNode; sessionId: string }) {
    const chat = useChat<ChatUIMessage>({
        id: sessionId,
        transport: new DefaultChatTransport({
            api: '/api/chat',
        }),
    });

    // `messages` is not a valid useChat option: after mount, the stored
    // messages for a session are pushed in once.
    useEffect(() => {
        chat.setMessages(readSession(sessionId));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId]);

    usePersistSession(sessionId, chat.messages);

    return <ChatContext value={useMemo(() => ({chat}), [chat])}>{children}</ChatContext>;
}

export function AISearchTrigger({
                                    position = 'default',
                                    className,
                                    ...props
                                }: ComponentProps<'button'> & { position?: 'default' | 'float' }) {
    const {open, setOpen} = useAISearchContext();

    return (
        <button
            data-state={open ? 'open' : 'closed'}
            className={cn(
                position === 'float' && [
                    'fixed bottom-4 gap-3 w-24 inset-e-[calc(--spacing(4)+var(--removed-body-scroll-bar-size,0px))] shadow-lg z-20 transition-[translate,opacity]',
                    open && 'translate-y-10 opacity-0',
                ],
                className,
            )}
            onClick={() => setOpen(!open)}
            {...props}
        >
            {props.children}
        </button>
    );
}

export function AISearchPanel() {
    const {open, setOpen} = useAISearchContext();
    const [actualOpen, setActualOpen] = useState(open);
    useHotKey();

    if (open && !actualOpen) setActualOpen(true);

    return (
        <>
            {actualOpen && (
                <div
                    className={cn(
                        'fixed inset-0 z-40 backdrop-blur-xs bg-fd-overlay lg:hidden',
                        open ? 'animate-fd-fade-in' : 'animate-fd-fade-out',
                    )}
                    onClick={() => setOpen(false)}
                    onAnimationEnd={() => {
                        if (!open) flushSync(() => setActualOpen(false));
                    }}
                />
            )}
            {actualOpen && (
                <div
                    className={cn(
                        'overflow-hidden z-40 bg-fd-card text-fd-card-foreground [--ai-chat-width:400px] 2xl:[--ai-chat-width:460px]',
                        'max-lg:fixed max-lg:inset-x-2 max-lg:inset-y-4 max-lg:border max-lg:rounded-2xl max-lg:shadow-xl',
                        'lg:sticky lg:top-0 lg:h-dvh lg:border-s lg:ms-auto lg:max-w-(--ai-chat-width) lg:in-[#nd-docs-layout]:[grid-area:toc]',
                        open ? 'animate-fd-fade-in' : 'animate-fd-fade-out',
                    )}
                    onAnimationEnd={() => {
                        if (!open) flushSync(() => setActualOpen(false));
                    }}
                >
                    <div className="flex size-full flex-col p-2 lg:w-(--ai-chat-width)">
                        <AISearchPanelHeader/>
                        <AISearchPanelList className="flex-1"/>
                        <div
                            className="rounded-xl border bg-fd-secondary text-fd-secondary-foreground shadow-sm has-focus-visible:shadow-md">
                            <AISearchInput/>
                            <div className="flex items-center gap-1.5 p-1 empty:hidden">
                                <AISearchInputActions/>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export function AISearchPanelList({className, style, ...props}: ComponentProps<'div'>) {
    const chat = useChatContext();
    const messages = chat.messages.filter((msg) => msg.role !== 'system');

    return (
        <List
            className={cn('py-4 overscroll-contain', className)}
            style={{
                maskImage:
                    'linear-gradient(to bottom, transparent, white 1rem, white calc(100% - 1rem), transparent 100%)',
                ...style,
            }}
            {...props}
        >
            {messages.length === 0 ? (
                <div
                    className="text-sm text-fd-muted-foreground/80 size-full flex flex-col items-center justify-center text-center gap-2">
                    <MessageCircleIcon fill="currentColor" stroke="none"/>
                    <p onClick={(e) => e.stopPropagation()}>Start a new chat below.</p>
                </div>
            ) : (
                <div className="flex flex-col px-3 gap-4">
                    {chat.error && (
                        <div className="p-2 bg-fd-secondary text-fd-secondary-foreground border rounded-lg">
                            <p className="text-xs text-fd-muted-foreground mb-1">
                                Request Failed: {chat.error.name}
                            </p>
                            <p className="text-sm">{chat.error.message}</p>
                        </div>
                    )}
                    {messages.map((item) => (
                        <Message key={item.id} message={item}/>
                    ))}
                </div>
            )}
        </List>
    );
}

export function useHotKey() {
    const {open, setOpen} = useAISearchContext();

    const onKeyPress = useEffectEvent((e: KeyboardEvent) => {
        if (e.key === 'Escape' && open) {
            setOpen(false);
            e.preventDefault();
        }

        if (e.key === '/' && (e.metaKey || e.ctrlKey) && !open) {
            setOpen(true);
            e.preventDefault();
        }
    });

    useEffect(() => {
        window.addEventListener('keydown', onKeyPress);
        return () => window.removeEventListener('keydown', onKeyPress);
    }, []);
}

export function useAISearchContext() {
    const session = use(SessionContext)!;
    const chat = use(ChatContext)!;
    return {...session, ...chat};
}

function useChatContext() {
    return use(ChatContext)!.chat;
}

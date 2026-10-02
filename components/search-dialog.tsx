'use client';

import {useMemo} from 'react';
import {useDocsSearch} from 'fumadocs-core/search/client';
import {fetchClient} from 'fumadocs-core/search/client/fetch';
import {createMarkdownRenderer} from 'fumadocs-core/content/md';
import {
    SearchDialog,
    SearchDialogClose,
    SearchDialogContent,
    SearchDialogFooter,
    SearchDialogHeader,
    SearchDialogIcon,
    SearchDialogInput,
    SearchDialogList,
    SearchDialogOverlay,
    type SearchItemType,
    useSearchList,
} from 'fumadocs-ui/components/dialog/search';
import type {SharedProps} from 'fumadocs-ui/contexts/search';
import {cn} from '@/lib/cn';

const md = createMarkdownRenderer();

function pageName(url: string): string {
    const path = url.split('#')[0];
    const slug = path.replace(/^\//, '').split('/').filter(Boolean).pop() ?? 'Overview';
    return slug
        .split('-')
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
        .join(' ');
}

function groupLabel(item: SearchItemType): string | null {
    if (item.type === 'action') return null;
    if (item.type === 'page') return 'Page';
    return pageName(item.url);
}

function Snippet({text}: { text: string }) {
    return (
        <span className="line-clamp-2 text-sm text-fd-popover-foreground/80">
      <md.Markdown
          components={{
              mark: (props) => <mark {...props}
                                     className="rounded-sm bg-fd-primary/20 px-px text-fd-primary underline"/>,
              p: (props) => <span {...props} />,
              code: (props) => <code {...props} className="rounded border bg-fd-secondary px-px font-mono text-xs"/>,
          }}
      >
        {text}
      </md.Markdown>
    </span>
    );
}

function ResultItem({item, onClick}: { item: SearchItemType; onClick: () => void }) {
    const {active, setActive} = useSearchList();
    const isActive = active === item.id;
    // Mouse and keyboard share one highlight: hovering a row moves the
    // selection, so the keyboard-highlighted row is never lit at the same time.
    // No hover:bg class on purpose — the pointer already drives `active`.
    const highlight = cn(
        'transition-colors',
        isActive && 'bg-fd-accent',
    );

    if (item.type === 'action') {
        return (
            <button
                type="button"
                onClick={onClick}
                onPointerMove={() => setActive(item.id)}
                className={cn(
                    'w-full shrink-0 select-none rounded-lg px-2.5 py-2 text-start text-sm text-fd-popover-foreground',
                    highlight,
                )}
            >
                {item.node}
            </button>
        );
    }
    return (
        <button
            type="button"
            onClick={onClick}
            onPointerMove={() => setActive(item.id)}
            className={cn(
                'flex w-full shrink-0 select-none flex-col gap-1 overflow-hidden rounded-lg px-2.5 py-2 text-start',
                'text-fd-popover-foreground',
                highlight,
            )}
        >
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm font-medium">{groupLabel(item)}</span>
        <span className="rounded border bg-fd-secondary px-1 py-px font-mono text-[11px] text-fd-muted-foreground">
          {item.url}
        </span>
        <span className="rounded bg-fd-secondary px-1 text-[10px] uppercase text-fd-muted-foreground">{item.type}</span>
      </span>
            {typeof item.content === 'string' ? <Snippet text={item.content}/> : item.content}
        </button>
    );
}

/** Orama returns the same chunk once per matching anchor; collapse those. */
function dedupe<T extends { url?: string; content?: unknown }>(items: T[]): T[] {
    const seen = new Set<string>();
    const out: T[] = [];

    for (const item of items) {
        const url = typeof item.url === 'string' ? item.url : '';
        const content = typeof item.content === 'string' ? item.content.trim().slice(0, 120) : 'node';
        const key = `${url.split('#')[0]}|${content}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(item);
    }

    return out;
}

export function DocsSearchDialog({open, onOpenChange, dialogHandle}: SharedProps) {
    const client = useMemo(() => fetchClient({api: '/api/search'}), []);
    const {search, setSearch, query} = useDocsSearch({client, delayMs: 150});
    const items = query.data !== 'empty' && Array.isArray(query.data) ? dedupe(query.data) : null;

    return (
        <SearchDialog open={open} onOpenChange={onOpenChange} search={search} onSearchChange={setSearch}
                      isLoading={query.isLoading} dialogHandle={dialogHandle}>
            <SearchDialogOverlay/>
            <SearchDialogContent>
                <SearchDialogHeader>
                    <SearchDialogIcon/>
                    <SearchDialogInput/>
                    <SearchDialogClose/>
                </SearchDialogHeader>
                <SearchDialogList
                    items={items}
                    Item={({item, onClick}) => <ResultItem item={item} onClick={onClick}/>}
                />
                <SearchDialogFooter>
                    <p className="px-3 py-2 text-xs text-fd-muted-foreground">
                        Results show the destination page path. Press Enter to open, Esc to close.
                    </p>
                </SearchDialogFooter>
            </SearchDialogContent>
        </SearchDialog>
    );
}

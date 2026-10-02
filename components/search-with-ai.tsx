'use client';

import {useEffect, useState} from 'react';
import {SearchTrigger} from 'fumadocs-ui/layouts/shared/slots/search-trigger';
import {SparklesIcon} from 'lucide-react';
import {AISearch, AISearchPanel, AISearchTrigger} from '@/components/ai/search';
import {buttonVariants} from '@/components/ui/button';
import {cn} from '@/lib/cn';

/**
 * Floating Ask AI launcher, pinned bottom-right on every viewport.
 * The panel it opens is a modal dialog (see AISearchPanel).
 */
export function AskAiFab() {
    const [enabled, setEnabled] = useState(false);

    useEffect(() => {
        let cancelled = false;
        fetch('/api/chat/config')
            .then((res) => (res.ok ? res.json() : {enabled: false}))
            .then((data) => {
                if (!cancelled) setEnabled(data.enabled === true);
            })
            .catch(() => {
            });
        return () => {
            cancelled = true;
        };
    }, []);

    if (!enabled) return null;

    return (
        <AISearch>
            <AISearchPanel/>
            <AISearchTrigger
                aria-label="Ask AI"
                position="float"
                className={cn(
                    buttonVariants({variant: 'secondary', size: 'icon'}),
                    'fixed right-5 bottom-5 z-40 size-12 rounded-full shadow-lg',
                )}
            >
                <SparklesIcon className="size-5"/>
            </AISearchTrigger>
        </AISearch>
    );
}

/** Navbar search slot: the stock trigger, untouched by the AI launcher. */
export function PlainSearchTrigger(props: React.ComponentProps<typeof SearchTrigger>) {
    return <SearchTrigger {...props}/>;
}

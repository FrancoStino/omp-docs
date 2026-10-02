'use client';

import {useEffect, useState} from 'react';
import {SparklesIcon} from 'lucide-react';
import {AISearch, AISearchPanel, AISearchTrigger} from '@/components/ai/search';
import {buttonVariants} from '@/components/ui/button';
import {cn} from '@/lib/cn';

/**
 * Ask AI rail. Mounted inside <DocsLayout> so the panel can occupy the
 * table-of-contents column; the trigger is a fixed launcher.
 */
export function AskAi() {
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
                className={cn(
                    buttonVariants({variant: 'secondary', size: 'icon'}),
                    'fixed right-5 bottom-5 z-40 size-12 rounded-full shadow-lg',
                    // The rail occupies that corner while open; the panel has
                    // its own close button, so fade the launcher out.
                    'data-[state=open]:pointer-events-none data-[state=open]:opacity-0',
                )}
            >
                <SparklesIcon className="size-5"/>
            </AISearchTrigger>
        </AISearch>
    );
}

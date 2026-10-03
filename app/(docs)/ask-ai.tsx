'use client';

import {useEffect, useState} from 'react';
import {MessageCircleIcon} from 'lucide-react';
import {AISearch, AISearchPanel, AISearchTrigger} from '@/components/ai/search';
import {buttonVariants} from '@/components/ui/button';
import {cn} from 'cn';

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
                position="float"
                className={cn(
                    buttonVariants({
                        variant: 'secondary',
                        className: 'text-fd-muted-foreground rounded-2xl',
                    }),
                )}
            >
                <MessageCircleIcon className="size-4.5"/>
                Ask AI
            </AISearchTrigger>
        </AISearch>
    );
}
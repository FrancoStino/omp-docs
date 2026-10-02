'use client';

import {useEffect, useState} from 'react';
import {AISearch, AISearchPanel, AISearchTrigger} from '@/components/ai/search';
import {buttonVariants} from '@/components/ui/button';
import {cn} from '@/lib/cn';

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
                position="float"
                className={cn(buttonVariants({variant: 'secondary', className: 'rounded-2xl'}))}
            >
                Ask AI
            </AISearchTrigger>
        </AISearch>
    );
}

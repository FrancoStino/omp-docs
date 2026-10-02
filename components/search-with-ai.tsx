'use client';

import {useEffect, useState} from 'react';
import {FullSearchTrigger, type FullSearchTriggerProps,} from 'fumadocs-ui/layouts/shared/slots/search-trigger';
import {SparklesIcon} from 'lucide-react';
import {AISearch, AISearchPanel, AISearchTrigger} from '@/components/ai/search';
import {buttonVariants} from '@/components/ui/button';
import {cn} from '@/lib/cn';

/** Navbar search slot: Ask AI sits directly next to the search button. */
export function SearchWithAi(props: FullSearchTriggerProps) {
    const [aiEnabled, setAiEnabled] = useState(false);

    useEffect(() => {
        let cancelled = false;
        fetch('/api/chat/config')
            .then((res) => (res.ok ? res.json() : {enabled: false}))
            .then((data) => {
                if (!cancelled) setAiEnabled(data.enabled === true);
            })
            .catch(() => {
            });
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div className="flex items-center gap-2">
            {aiEnabled && (
                <AISearch>
                    <AISearchPanel/>
                    <AISearchTrigger
                        className={cn(
                            buttonVariants({variant: 'secondary', size: 'sm'}),
                            'gap-1.5 rounded-lg',
                        )}
                    >
                        <SparklesIcon className="size-4"/>
                        Ask
                    </AISearchTrigger>
                </AISearch>
            )}
            <FullSearchTrigger {...props}/>
        </div>
    );
}

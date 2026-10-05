'use client';
import {DocsLayout as Layout, type DocsLayoutProps} from 'fumadocs-ui/layouts/docs';
import {AISearch, AISearchPanel, AISearchTrigger, useAISearchContext, useHotKey} from '@/components/ai/search';
import {buttonVariants} from 'fumadocs-ui/components/ui/button';
import {MessageCircleIcon} from 'lucide-react';

export function DocsLayout(props: DocsLayoutProps) {
    return (
        <AISearch>
            <ChatLayout {...props} />
            <AISearchTrigger
                position="float"
                className={buttonVariants({variant: 'secondary', className: 'rounded-2xl gap-2'})}
            >
                <MessageCircleIcon className="size-4.5"/>
                Ask AI
            </AISearchTrigger>
        </AISearch>
    );
}

function ChatLayout(props: DocsLayoutProps) {
    const {open, setOpen} = useAISearchContext();
    useHotKey();

    return <Layout {...props} aiChat={{open, onOpenChange: setOpen, panel: <AISearchPanel/>}}/>;
}

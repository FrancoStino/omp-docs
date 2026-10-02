import {source} from '@/lib/source';
import {DocsLayout} from 'fumadocs-ui/layouts/docs';
import {baseOptions} from '@/lib/layout.shared';
import {AskAi} from '@/components/ai/ask-ai';
import {SyncBadge} from '@/components/sync-badge';

export default function Layout({children}: LayoutProps<'/docs'>) {
    return (
        <DocsLayout tree={source.getPageTree()} {...baseOptions()} sidebar={{footer: <SyncBadge/>}}>
            <AskAi/>
            {children}
        </DocsLayout>
    );
}

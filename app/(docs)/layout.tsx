import {source} from '@/lib/source';
import {DocsLayout} from 'fumadocs-ui/layouts/docs';
import {baseOptions} from '@/lib/layout.shared';
import {SyncBadge} from '@/components/sync-badge';
import {DocsProviders} from './providers';

export default function Layout({children}: LayoutProps<'/'>) {
    return (
        <DocsProviders>
            <DocsLayout tree={source.getPageTree()} {...baseOptions()} sidebar={{footer: <SyncBadge/>}}>
                {children}
            </DocsLayout>
        </DocsProviders>
    );
}
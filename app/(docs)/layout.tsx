import {source} from '@/lib/source';
import {DocsLayout} from 'fumadocs-ui/layouts/docs';
import {baseOptions} from '@/lib/layout.shared';
import {SyncChipSha} from '@/components/sync-chip';
import {DocsProviders} from './providers';
import {AskAi} from './ask-ai';

export default function Layout({children}: LayoutProps<'/'>) {
    return (
        <DocsProviders>
            <DocsLayout
                tree={source.getPageTree()}
                {...baseOptions()}
                sidebar={{
                    footer: (
                        <p className="flex items-center gap-1.5 px-2 pt-1 text-[11px] text-fd-muted-foreground/70">
                            <span className="size-1 shrink-0 rounded-full bg-fd-primary"/>
                            <span>
                                synced <SyncChipSha/>
                            </span>
                        </p>
                    ),
                }}
            >
                {/* The AI rail must live inside the docs grid, otherwise
                    `grid-area: toc` has no grid to attach to and it drops
                    to the bottom of the page. */}
                <AskAi/>
                {children}
            </DocsLayout>
        </DocsProviders>
    );
}
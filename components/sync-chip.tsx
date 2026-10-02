import {getLastSynced} from '@/lib/sync-state';

/** Navbar chip: dot + synced SHA, links to the plain-text index. */
export async function SyncChipNav() {
    const sha = await getLastSynced();

    return (
        <a
            href="/llms.txt"
            title="Docs synced with the oh-my-pi repository. Click for the plain-text index."
            className="fd-border text-fd-muted-foreground hover:text-fd-primary hidden h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs transition-colors sm:inline-flex"
        >
            <span className="size-1.5 shrink-0 rounded-full bg-fd-primary"/>
            <span>synced</span>
            <code className="font-mono">{sha}</code>
        </a>
    );
}

/** Inline SHA for the sidebar footer line. Server-rendered, static. */
export async function SyncChipSha() {
    return <code className="font-mono">{await getLastSynced()}</code>;
}

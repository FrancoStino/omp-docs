import {getLastSynced} from '@/lib/sync-state';

export async function SyncBadge() {
    const lastSynced = await getLastSynced();
    return <p className="px-2 text-xs text-fd-muted-foreground">last-synced: {lastSynced}</p>;
}

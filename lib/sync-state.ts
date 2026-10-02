import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

export async function getLastSynced(): Promise<string> {
    try {
        const raw = await readFile(join(process.cwd(), 'public', 'sync-state.json'), 'utf8');
        const state = JSON.parse(raw) as { sha?: string };
        return typeof state.sha === 'string' && state.sha.length >= 7 ? state.sha.slice(0, 7) : 'bootstrap';
    } catch {
        return 'bootstrap';
    }
}

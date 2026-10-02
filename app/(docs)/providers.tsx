'use client';

import {RootProvider} from 'fumadocs-ui/provider/next';
import {DocsSearchDialog} from '@/components/search-dialog';
import type {ReactNode} from 'react';

export function DocsProviders({children}: { children: ReactNode }) {
    return (
        <RootProvider
            search={{
                SearchDialog: DocsSearchDialog,
            }}
        >
            <div className="flex min-h-screen flex-col">{children}</div>
        </RootProvider>
    );
}

import {RootProvider} from 'fumadocs-ui/provider/next';
import {DocsSearchDialog} from '@/components/search-dialog';

export default function Layout({children}: LayoutProps<'/'>) {
    return (
        <RootProvider
            search={{
                SearchDialog: DocsSearchDialog,
            }}
        >
            <div className="flex flex-col min-h-screen">{children}</div>
        </RootProvider>
    );
}

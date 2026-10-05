import {source} from '@/lib/source';
import {PiLogo} from '@/components/pi-logo';
import {DocsProviders} from './providers';
import {DocsLayout} from '@/components/ai/layout';

export default function Layout({children}: LayoutProps<'/'>) {
    return (
        <DocsProviders>
            <DocsLayout
                tree={source.getPageTree()}
                githubUrl="https://github.com/can1357/oh-my-pi"
                nav={{
                    title: (
                        <span className="inline-flex items-center gap-2 whitespace-nowrap">
                            <PiLogo/>
                            <span className="font-semibold tracking-tight">OMP Docs</span>
                        </span>
                    ),
                }}
            >
                {children}
            </DocsLayout>
        </DocsProviders>
    );
}

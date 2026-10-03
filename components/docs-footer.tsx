'use client';

import type {FooterProps} from 'fumadocs-ui/layouts/docs/page/slots/footer';
import {PiLogo} from '@/components/pi-logo';

const CATEGORY_LINKS = [
    {
        title: 'Get started',
        items: [
            {label: 'Quickstart', href: '/get-started/quickstart'},
            {label: 'Using omp', href: '/get-started/using'},
            {label: 'Sessions', href: '/get-started/sessions'},
        ],
    },
    {
        title: 'Configure',
        items: [
            {label: 'Providers', href: '/models/providers'},
            {label: 'Settings', href: '/configuration/settings'},
            {label: 'Environment variables', href: '/configuration/env'},
        ],
    },
    {
        title: 'Extend',
        items: [
            {label: 'MCP', href: '/extend/mcp'},
            {label: 'Skills', href: '/extend/skills'},
            {label: 'Plugins', href: '/extend/plugins'},
            {label: 'Extensions', href: '/extend/extension-authoring'},
        ],
    },
    {
        title: 'Reference',
        items: [
            {label: 'Slash commands', href: '/workflows/slash'},
            {label: 'CLI', href: '/reference/cli'},
            {label: 'Keybindings', href: '/reference/keybindings'},
        ],
    },
] as const;

export function DocsFooter({items, ...props}: FooterProps) {
    return (
        <div {...props} className="fd-border-t mt-12 pt-8">
            {items && (items.previous || items.next) && (
                <div className="grid gap-3 sm:grid-cols-2">
                    {items.previous ? (
                        <a
                            href={items.previous.url}
                            className="fd-border group rounded-lg p-4 transition-colors hover:bg-fd-accent"
                        >
                            <span className="text-fd-muted-foreground text-xs">← Previous</span>
                            <span className="mt-1 block font-medium group-hover:text-fd-primary">
                {items.previous.name}
              </span>
                        </a>
                    ) : (
                        <span/>
                    )}
                    {items.next && (
                        <a
                            href={items.next.url}
                            className="fd-border group rounded-lg p-4 text-right transition-colors hover:bg-fd-accent"
                        >
                            <span className="text-fd-muted-foreground text-xs">Next →</span>
                            <span className="mt-1 block font-medium group-hover:text-fd-primary">
                {items.next.name}
              </span>
                        </a>
                    )}
                </div>
            )}

            <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                {CATEGORY_LINKS.map((group) => (
                    <div key={group.title}>
                        <p className="mb-3 text-xs font-semibold tracking-wide uppercase">{group.title}</p>
                        <ul className="space-y-2">
                            {group.items.map((item) => (
                                <li key={item.label}>
                                    <a
                                        href={item.href}
                                        className="text-fd-muted-foreground hover:text-fd-primary text-sm transition-colors"
                                    >
                                        {item.label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>

            <div className="fd-border-t mt-10 flex flex-wrap items-center justify-between gap-4 pt-6">
                <div className="flex items-center gap-2">
                    <PiLogo className="size-5"/>
                    <span className="text-sm font-medium">OMP Docs</span>
                    <span className="text-fd-muted-foreground text-xs">· always in sync with upstream</span>
                </div>
                <div className="text-fd-muted-foreground flex items-center gap-4 text-xs">
                    <a
                        href="https://github.com/can1357/oh-my-pi"
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-fd-primary transition-colors"
                    >
                        oh-my-pi
                    </a>
                    <a
                        href="https://omp.sh/docs"
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-fd-primary transition-colors"
                    >
                        omp.sh/docs
                    </a>
                    <span>Content MIT · Stencil Labs</span>
                </div>
            </div>
        </div>
    );
}

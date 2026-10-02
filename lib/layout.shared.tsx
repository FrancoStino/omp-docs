import type {BaseLayoutProps} from 'fumadocs-ui/layouts/shared';
import {PiLogo} from '@/components/pi-logo';
import {SyncChipNav} from '@/components/sync-chip';

export function baseOptions(): BaseLayoutProps {
    return {
        githubUrl: 'https://github.com/can1357/oh-my-pi',
        nav: {
            title: (
                <span className="inline-flex items-center gap-2 whitespace-nowrap">
                    <PiLogo/>
                    <span className="font-semibold tracking-tight">OMP Docs</span>
                </span>
            ),
            children: <SyncChipNav/>,
        },
    };
}
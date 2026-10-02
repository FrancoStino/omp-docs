import type {BaseLayoutProps} from 'fumadocs-ui/layouts/shared';
import {SearchTrigger} from 'fumadocs-ui/layouts/shared/slots/search-trigger';
import {PiLogo} from '@/components/pi-logo';
import {SearchWithAi} from '@/components/search-with-ai';

export function baseOptions(): BaseLayoutProps {
    return {
        githubUrl: 'https://github.com/can1357/oh-my-pi',
        nav: {
            title: (
                <span className="inline-flex items-center gap-2">
          <PiLogo/>
          <span className="font-semibold tracking-tight">OMP Docs</span>
        </span>
            ),
        },
        slots: {
            searchTrigger: {
                sm: SearchTrigger,
                full: SearchWithAi,
            },
        },
    };
}

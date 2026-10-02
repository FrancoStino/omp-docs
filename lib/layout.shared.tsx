import type {BaseLayoutProps} from 'fumadocs-ui/layouts/shared';
import {PiLogo} from '@/components/pi-logo';

export function baseOptions(): BaseLayoutProps {
    return {
        nav: {
            title: (
                <span className="inline-flex items-center gap-2">
          <PiLogo/>
          <span className="font-semibold tracking-tight">OMP Docs</span>
        </span>
            ),
        },
    };
}

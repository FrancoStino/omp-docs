import {cva} from 'class-variance-authority';

const variants = {
    default: 'bg-fd-primary text-fd-primary-foreground hover:bg-fd-primary/80',
    outline: 'border hover:bg-fd-accent hover:text-fd-accent-foreground',
    ghost: 'hover:bg-fd-accent hover:text-fd-accent-foreground',
    secondary:
        'border bg-fd-secondary text-fd-secondary-foreground hover:bg-fd-accent hover:text-fd-accent-foreground',
} as const;

export const buttonVariants = cva(
    'inline-flex h-9 items-center justify-center rounded-lg p-2 text-sm font-medium transition-colors duration-100 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring',
    {
        variants: {
            variant: variants,
            size: {
                sm: 'h-8 gap-1 px-2 py-1.5 text-xs',
                icon: 'h-9 w-9 p-1.5 [&_svg]:size-5',
                'icon-sm': 'h-8 w-8 p-1.5 [&_svg]:size-4.5',
                'icon-xs': 'h-7 w-7 p-1 [&_svg]:size-4',
            },
        },
    },
);


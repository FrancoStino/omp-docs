import type {NextConfig} from 'next';
import {createMDX} from 'fumadocs-mdx/next';

const nextConfig: NextConfig = {
    turbopack: {
        root: import.meta.dirname,
    },
    async rewrites() {
        return [
            // /quickstart.md -> /llms.mdx/quickstart/content.md
            {
                source: '/:slug*.md',
                destination: '/llms.mdx/:slug*/content.md',
            },
        ];
    },
    async redirects() {
        return [
            // Legacy /docs/... URLs from before the move to the site root
            {source: '/docs', destination: '/', permanent: true},
            {source: '/docs/:slug*', destination: '/:slug*', permanent: true},
        ];
    },
};

const withMDX = createMDX();

export default withMDX(nextConfig);
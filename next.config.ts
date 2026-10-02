import type {NextConfig} from "next";
import {createMDX} from 'fumadocs-mdx/next';

const nextConfig: NextConfig = {
    async rewrites() {
        return [
            {
                source: '/docs/:slug*.md',
                destination: '/llms.mdx/docs/:slug*/content.md',
            },
        ];
    },
    async redirects() {
        return [
            {
                source: '/',
                destination: '/docs',
                permanent: false,
            },
        ];
    },
};

const withMDX = createMDX();

export default withMDX(nextConfig);

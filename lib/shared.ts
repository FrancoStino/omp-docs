import {createGetUrl} from 'fumadocs-core/source';

// Docs live at the site root: https://example.com/quickstart, not /docs/quickstart
export const docsRoute = '/';
export const docsContentRoute = '/llms.mdx';

const getContentUrl = createGetUrl(docsContentRoute);

export function getPageMarkdownUrl(page: { slugs: string[]; locale?: string }) {
    const segments = [...page.slugs, 'content.md'];

    return {segments, url: getContentUrl(segments, page.locale)};
}
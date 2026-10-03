import {source} from '@/lib/source';
import {
    DocsBody,
    DocsDescription,
    DocsPage,
    DocsTitle,
    MarkdownCopyButton,
    ViewOptionsPopover
} from 'fumadocs-ui/layouts/docs/page';
import {notFound} from 'next/navigation';
import {getMDXComponents} from '@/components/mdx';
import type {Metadata} from 'next';
import {createRelativeLink} from 'fumadocs-ui/mdx';
import {DocsFooter} from '@/components/docs-footer';
import {getPageMarkdownUrl} from '@/lib/shared';

export default async function Page(props: PageProps<'/[[...slug]]'>) {
    const params = await props.params;
    const page = source.getPage(params.slug);
    if (!page) notFound();

    const MDX = page.data.body;
    const markdownUrl = getPageMarkdownUrl(page).url;

    return (
        <DocsPage toc={page.data.toc} full={page.data.full} slots={{footer: DocsFooter}}>
            <DocsTitle>{page.data.title}</DocsTitle>
            <DocsDescription>{page.data.description}</DocsDescription>
            <div className="flex flex-row gap-2 items-center border-b pt-2 pb-6">
                <MarkdownCopyButton markdownUrl={markdownUrl}/>
                <ViewOptionsPopover
                    markdownUrl={markdownUrl}
                    githubUrl={`https://github.com/can1357/oh-my-pi/blob/main/content/docs/${page.path}`}
                />
            </div>
            <DocsBody>
                <MDX
                    components={getMDXComponents({
                        // this allows you to link to other pages with relative file paths
                        a: createRelativeLink(source, page),
                    })}
                />
            </DocsBody>
        </DocsPage>
    );
}

export async function generateStaticParams() {
    return source.generateParams();
}

export async function generateMetadata(props: PageProps<'/[[...slug]]'>): Promise<Metadata> {
    const params = await props.params;
    const page = source.getPage(params.slug);
    if (!page) notFound();

    return {
        title: page.data.title,
        description: page.data.description,
    };
}

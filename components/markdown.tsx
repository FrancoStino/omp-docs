import {createMarkdownRenderer} from 'fumadocs-core/content/md';
import remarkGfm from 'remark-gfm';
import {DynamicCodeBlock} from 'fumadocs-ui/components/dynamic-codeblock';
import {Children, type ComponentProps, type ReactElement, Suspense, useDeferredValue} from 'react';

const md = createMarkdownRenderer({remarkPlugins: [remarkGfm]});

function Pre(props: ComponentProps<'pre'>) {
    const code = Children.only(props.children) as ReactElement;
    const codeProps = code.props as ComponentProps<'code'>;
    const content = codeProps.children;
    if (typeof content !== 'string') return null;

    let lang =
        codeProps.className
            ?.split(' ')
            .find((v) => v.startsWith('language-'))
            ?.slice('language-'.length) ?? 'text';

    if (lang === 'mdx') lang = 'md';

    return <DynamicCodeBlock lang={lang} code={content.trimEnd()}/>;
}

export function Markdown({text}: { text: string }) {
    const deferredText = useDeferredValue(text);

    return (
        <Suspense fallback={<p className="invisible">{text}</p>}>
            <md.Markdown components={{pre: Pre}}>{deferredText}</md.Markdown>
        </Suspense>
    );
}
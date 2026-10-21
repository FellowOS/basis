import {
  Children,
  isValidElement,
  type AnchorHTMLAttributes,
  type ComponentType,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';

import { docsHeadingSlug } from '@/lib/marketing/docs-slug.js';
import { cn } from '@/lib/utils.js';

export type DocsMdxComponents = {
  [tag: string]: ComponentType<any>;
};

function headingChildrenToText(children: ReactNode): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map((c) => headingChildrenToText(c)).join('');
  if (isValidElement<{ children?: ReactNode }>(children)) {
    return headingChildrenToText(children.props.children);
  }
  return String(children ?? '');
}

function HeadingLink({ id, children }: { id?: string; children: ReactNode }) {
  if (!id) return children;
  return (
    <a href={`#${id}`} className="text-foreground no-underline hover:underline">
      {children}
    </a>
  );
}

function fencedCodeLanguage(className: string | undefined, children: ReactNode): string | null {
  const fromPre = className?.match(/language-([\w-]+)/);
  if (fromPre?.[1]) return fromPre[1];
  const child = Children.toArray(children)[0];
  if (!isValidElement<{ 'data-language'?: string; className?: string }>(child)) return null;
  const fromData = child.props['data-language'];
  if (fromData && fromData !== 'plaintext') return fromData;
  const match = String(child.props.className ?? '').match(/language-([\w-]+)/);
  return match?.[1] ?? null;
}

function isInlineCode(className: string | undefined, children: ReactNode): boolean {
  if (className?.includes('language-') || className?.includes('shiki')) return false;
  if (typeof children !== 'string') return false;
  return !children.includes('\n');
}

export const docsMdxComponents: DocsMdxComponents = {
  h1: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement> & { children?: ReactNode }) => {
    const id = docsHeadingSlug(headingChildrenToText(children));
    return (
      <h2
        id={id}
        className="mt-10 mb-4 scroll-mt-24 border-b border-border pb-2 text-xl font-semibold tracking-tight first:mt-0"
        {...props}
      >
        <HeadingLink id={id}>{children}</HeadingLink>
      </h2>
    );
  },
  h2: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement> & { children?: ReactNode }) => {
    const id = docsHeadingSlug(headingChildrenToText(children));
    return (
      <h2
        id={id}
        className="mt-10 mb-3 scroll-mt-24 text-lg font-semibold tracking-tight text-foreground"
        {...props}
      >
        <HeadingLink id={id}>{children}</HeadingLink>
      </h2>
    );
  },
  h3: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement> & { children?: ReactNode }) => {
    const id = docsHeadingSlug(headingChildrenToText(children));
    return (
      <h3 id={id} className="mt-8 mb-2 scroll-mt-24 text-base font-semibold text-foreground" {...props}>
        <HeadingLink id={id}>{children}</HeadingLink>
      </h3>
    );
  },
  h4: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement> & { children?: ReactNode }) => {
    const id = docsHeadingSlug(headingChildrenToText(children));
    return (
      <h4 id={id} className="mt-6 mb-2 scroll-mt-24 text-sm font-medium text-foreground" {...props}>
        <HeadingLink id={id}>{children}</HeadingLink>
      </h4>
    );
  },
  p: (props: HTMLAttributes<HTMLParagraphElement>) => (
    <p className="mb-4 leading-relaxed text-muted-foreground" {...props} />
  ),
  a: ({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => {
    if (href?.startsWith('/')) {
      return (
        <Link
          to={href}
          className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
          {...props}
        />
      );
    }
    return (
      <a
        href={href}
        className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
        {...props}
      />
    );
  },
  ul: (props: HTMLAttributes<HTMLUListElement>) => (
    <ul className="mb-4 list-disc space-y-1 pl-6 text-muted-foreground" {...props} />
  ),
  ol: (props: HTMLAttributes<HTMLOListElement>) => (
    <ol className="mb-4 list-decimal space-y-1 pl-6 text-muted-foreground" {...props} />
  ),
  li: (props: HTMLAttributes<HTMLLIElement>) => <li className="leading-relaxed" {...props} />,
  figure: (props: HTMLAttributes<HTMLElement>) => (
    <figure className="relative my-5 overflow-hidden rounded-lg border border-border bg-muted/30" {...props} />
  ),
  blockquote: (props: HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className="my-4 border-l-2 border-border pl-4 text-muted-foreground italic"
      {...props}
    />
  ),
  code: ({
    className,
    children,
    ...props
  }: HTMLAttributes<HTMLElement> & { className?: string; children?: ReactNode }) => {
    if (className?.includes('shiki') || !isInlineCode(className, children)) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground" {...props}>
        {children}
      </code>
    );
  },
  pre: ({
    className,
    children,
    icon: _icon,
    ...props
  }: HTMLAttributes<HTMLPreElement> & { icon?: string }) => {
    const isShiki = className?.includes('shiki');
    const lang = isShiki ? fencedCodeLanguage(className, children) : null;
    const preEl = (
      <pre
        className={cn(
          'overflow-x-auto p-4 font-mono text-xs leading-relaxed',
          '[&>code]:bg-transparent [&>code]:p-0',
          className,
        )}
        {...props}
      >
        {children}
      </pre>
    );
    if (!isShiki) return preEl;
    return (
      <div className="relative my-5 overflow-hidden rounded-lg border border-border">
        {lang ? (
          <span
            className="pointer-events-none absolute top-2.5 right-3 z-10 text-[10px] font-medium tracking-wide text-muted-foreground uppercase"
          >
            {lang}
          </span>
        ) : null}
        {preEl}
      </div>
    );
  },
  hr: (props: HTMLAttributes<HTMLHRElement>) => <hr className="my-10 border-border" {...props} />,
  table: (props: HTMLAttributes<HTMLTableElement>) => (
    <div className="my-6 overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[32rem] border-collapse text-sm" {...props} />
    </div>
  ),
  th: (props: HTMLAttributes<HTMLTableCellElement>) => (
    <th
      className="border-b border-border bg-muted/40 px-3 py-2 text-left font-medium text-foreground"
      {...props}
    />
  ),
  td: (props: HTMLAttributes<HTMLTableCellElement>) => (
    <td className="border-b border-border px-3 py-2 align-top text-muted-foreground" {...props} />
  ),
};

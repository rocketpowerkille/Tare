import type { AnchorHTMLAttributes, MouseEvent } from 'react';

interface AppLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
}

export function navigate(href: string) {
  window.history.pushState({}, '', href);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0, behavior: 'instant' });
}

export function AppLink({ href, onClick, ...props }: AppLinkProps) {
  function follow(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(href);
  }
  return <a href={href} onClick={follow} {...props} />;
}

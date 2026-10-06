import { Fragment, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/** Expands (async) function components into plain host elements so server components can be rendered in tests. */
export async function resolveTree(node: ReactNode): Promise<ReactNode> {
  if (node === null || node === undefined || typeof node !== "object") return node;
  if (Array.isArray(node)) return Promise.all(node.map(resolveTree));
  if (!isValidElement(node)) return node;
  const el = node as ReactElement<{ children?: ReactNode }>;
  if (typeof el.type === "function") {
    const fn = el.type as (p: unknown) => ReactNode | Promise<ReactNode>;
    const out = await resolveTree(await fn(el.props));
    return isValidElement(out) && el.key !== null && out.key === null ? cloneElement(out, { key: el.key }) : out;
  }
  if ((el.type as unknown) === Fragment || typeof el.type === "string") {
    const kids = el.props.children;
    if (kids === undefined) return el;
    return cloneElement(el, undefined, await resolveTree(kids));
  }
  return el;
}

export async function renderToHtml(node: ReactNode) {
  return renderToStaticMarkup((await resolveTree(node)) as ReactElement);
}

export async function renderPage(page: (props: never) => Promise<ReactNode> | ReactNode, props: unknown = {}) {
  return renderToHtml(await (page as (p: unknown) => Promise<ReactNode>)(props));
}

type Action = (fd: FormData) => Promise<void>;

/** Finds every function passed as a form `action` anywhere in a React element tree, keyed by function name. */
export function findActions(node: unknown, found: Record<string, Action> = {}): Record<string, Action> {
  if (!node || typeof node !== "object") return found;
  if (Array.isArray(node)) {
    node.forEach((n) => findActions(n, found));
    return found;
  }
  if (!isValidElement(node)) return found;
  const props = (node as ReactElement<Record<string, unknown>>).props;
  if (node.type === "form" && typeof props.action === "function") found[(props.action as Action).name] = props.action as Action;
  for (const v of Object.values(props)) findActions(v, found);
  return found;
}

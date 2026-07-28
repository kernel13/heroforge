/**
 * Interpolating React elements into a translated sentence.
 *
 * The alternative — splitting a sentence into "text before the link", "the link", "text after" —
 * hard-codes English word order into the component and leaves a translator no way to move the
 * link. Passing the whole sentence with a `{link}` placeholder keeps the ordering inside the
 * dictionary where it belongs.
 */
import { Fragment, type ReactNode } from "react";

/**
 * Split `template` on `{name}` placeholders and interleave the matching nodes.
 *
 * A placeholder with no node is left as written, for the same reason `fill` leaves one alone:
 * a visible `{link}` is a bug someone reports, an empty gap is a bug nobody notices.
 */
export function interpolate(template: string, nodes: Record<string, ReactNode>): ReactNode {
  const parts = template.split(/(\{\w+\})/g);
  return parts.map((part, index) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    const node = name === undefined ? undefined : nodes[name];
    return <Fragment key={index}>{node ?? part}</Fragment>;
  });
}

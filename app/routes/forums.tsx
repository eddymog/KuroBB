import { Link } from "react-router";

import { PageHeading } from "~/components/ui/PageHeading";
import { getForumTree } from "~server/features/forums/service";
import type { ForumNode } from "~server/features/forums/tree";

import type { Route } from "./+types/forums";

export function meta() {
  return [
    { title: "Foros · KuroBB" },
    { name: "description", content: "Explora los foros de KuroBB." },
  ];
}

export async function loader() {
  const tree = await getForumTree();
  return { tree };
}

function ForumList({ nodes, depth = 0 }: { nodes: ForumNode[]; depth?: number }) {
  if (nodes.length === 0) return null;
  return (
    <ul className={depth > 0 ? "pl-6" : undefined}>
      {nodes.map((node) => (
        <li key={node.id} className="border-b border-border py-3 last:border-b-0">
          <div className="flex items-baseline justify-between gap-4">
            <Link to={`/forums/${node.id}`} className="font-serif text-lg text-ink">
              {node.name}
            </Link>
            <span className="shrink-0 text-sm text-ink-muted">
              {node.threadCount} tema{node.threadCount === 1 ? "" : "s"}
            </span>
          </div>
          {node.description && <p className="mt-1 text-sm text-ink-muted">{node.description}</p>}
          {node.children.length > 0 && <ForumList nodes={node.children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}

export default function Forums({ loaderData }: Route.ComponentProps) {
  const isEmpty = loaderData.tree.length === 0;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 p-6 md:p-8">
      <div className="flex items-baseline justify-between">
        <PageHeading>Foros</PageHeading>
        {!isEmpty && (
          <Link to="/forums/new" className="text-sm text-accent">
            Crear un foro
          </Link>
        )}
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-ink-muted">Aún no hay foros.</p>
          <Link to="/forums/new" className="text-accent">
            Crear el primer foro
          </Link>
        </div>
      ) : (
        <ForumList nodes={loaderData.tree} />
      )}
    </main>
  );
}

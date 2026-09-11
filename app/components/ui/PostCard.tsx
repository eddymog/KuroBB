import { Link } from "react-router";

// Deliberately takes a resolved `authorLabel` rather than a userId — keeps
// this component presentational only. Resolving userId -> username needs a
// join `posts`/`threads` repositories don't do yet (they only select the
// bare row); Step 4 wiring this into threads.$threadId.tsx has to add that,
// not invent it here.
interface PostCardProps {
  postId: number;
  authorLabel: string;
  createdAt: string | Date;
  bodyHtml: string | null;
  canEdit: boolean;
}

export function PostCard({ postId, authorLabel, createdAt, bodyHtml, canEdit }: PostCardProps) {
  return (
    <article className="border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-ink">{authorLabel}</span>
        <time className="text-xs text-ink-muted">{new Date(createdAt).toLocaleString()}</time>
      </div>
      {/* .post-body's element styles live in app.css — this is raw sanitized
          HTML from server/lib/bbcode.ts, not JSX, so Tailwind classes can't
          reach into it directly. */}
      <div className="post-body text-ink" dangerouslySetInnerHTML={{ __html: bodyHtml ?? "" }} />
      {canEdit && (
        <p className="mt-2 text-sm">
          <Link to={`/posts/${postId}/edit`} className="text-accent">
            Editar
          </Link>
        </p>
      )}
    </article>
  );
}

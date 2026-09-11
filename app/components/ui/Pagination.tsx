import { Link } from "react-router";

interface PaginationProps {
  page: number;
  totalPages: number;
}

// STYLE.md §5 — hidden (not disabled-and-visible) when there's no adjacent
// page. Shared by forums.$forumId and threads.$threadId, which had two
// slightly different inline implementations of this before Step 2.
export function Pagination({ page, totalPages }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav className="flex items-center gap-4 text-sm">
      <span className="text-ink-muted">
        Página {page} de {totalPages}
      </span>
      {page > 1 && (
        <Link to={`?page=${page - 1}`} className="text-accent">
          Anterior
        </Link>
      )}
      {page < totalPages && (
        <Link to={`?page=${page + 1}`} className="text-accent">
          Siguiente
        </Link>
      )}
    </nav>
  );
}

import { Link } from "react-router";

export interface NavBarUser {
  username: string;
  isAdmin: boolean;
}

export function NavBar({ user }: { user: NavBarUser | null }) {
  return (
    <header className="border-b border-border bg-surface-2">
      <div className="mx-auto flex max-w-4xl items-center justify-between p-4">
        <Link to="/forums" className="font-serif text-xl font-semibold text-ink">
          KuroBB
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium text-ink">
          <Link to="/forums" className="hover:text-accent">
            Forums
          </Link>
          {user && (
            <Link to="/settings" className="hover:text-accent">
              Settings
            </Link>
          )}
          {user?.isAdmin && (
            <Link to="/admin" className="hover:text-accent">
              Admin
            </Link>
          )}
          {user ? (
            <>
              <span className="text-ink-muted">{user.username}</span>
              {/* A link, not an inline action — logout is a mutation, and
                  /auth/logout already has its own confirm-button page (§07). */}
              <Link to="/auth/logout" className="hover:text-accent">
                Log out
              </Link>
            </>
          ) : (
            <Link to="/auth/login" className="hover:text-accent">
              Log in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";

import { NavBar } from "~/components/ui/NavBar";
import { NavigationProgress } from "~/components/ui/NavigationProgress";
import { PageHeading } from "~/components/ui/PageHeading";
import { getCurrentUser } from "~server/features/auth/service";

import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Newsreader:wght@400;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <NavigationProgress />
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// Not `requireUser` — the nav has to render for logged-out visitors too.
// Only `id`/`username`/`isAdmin` cross the wire: `getCurrentUser` returns the
// full row (passwordHash included), and loaderData is serialized straight
// into the page for hydration — visible in view-source, not just "unused
// in the render." Stripping it here, not trusting NavBar to ignore it.
export async function loader({ request }: Route.LoaderArgs) {
  const user = await getCurrentUser(request);
  return { user: user ? { id: user.id, username: user.username, isAdmin: user.isAdmin } : null };
}

export default function App({ loaderData }: Route.ComponentProps) {
  const location = useLocation();
  return (
    <>
      <NavBar user={loaderData.user} />
      {/* Keyed by the location itself, not just pathname — a pagination
          link only changes ?page=, and a route change should still visibly
          register. React remounting the div on every navigation is what
          replays the CSS animation below; it isn't tied to how long the
          navigation actually took (unlike NavigationProgress), so it fires
          the same way whether the data was instant or slow. */}
      <div key={location.key} className="page-transition">
        <Outlet />
      </div>
    </>
  );
}

export function ErrorBoundary({ error, loaderData }: Route.ErrorBoundaryProps) {
  const location = useLocation();
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    // kurobb-design.md §06's error envelope, thrown via server/lib/errors.ts's
    // throwAppError — data.error is present whenever this came from our own
    // AppError helper rather than an unmatched route or a thrown Response.
    const body = error.data as { error?: { code: string; message: string } } | undefined;
    if (body?.error) {
      message = body.error.code;
      details = body.error.message;
    } else {
      message = error.status === 404 ? "404" : "Error";
      details =
        error.status === 404
          ? "The requested page could not be found."
          : error.statusText || details;
    }
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  // This boundary substitutes for the whole `App` component (NavBar included)
  // whenever no route below root defines its own boundary — without
  // rendering NavBar here too, an error page would drop the nav entirely and
  // read as a different, broken product rather than this one hitting a
  // snag. Root's own loader ran fine in this case (it never throws), so
  // `loaderData` is still the real `{user}` shape, not a fallback.
  return (
    <>
      <NavBar user={loaderData?.user ?? null} />
      <main
        key={location.key}
        className="page-transition mx-auto flex max-w-2xl flex-col gap-4 p-6 md:p-8"
      >
        <PageHeading>{message}</PageHeading>
        <p className="text-ink-muted">{details}</p>
        {stack && (
          <pre className="w-full overflow-x-auto border border-border bg-surface p-4 text-xs">
            <code>{stack}</code>
          </pre>
        )}
        <Link to="/forums" className="text-accent hover:underline">
          Back to forums
        </Link>
      </main>
    </>
  );
}

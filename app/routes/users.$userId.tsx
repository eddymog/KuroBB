import { PageHeading } from "~/components/ui/PageHeading";
import { getPublicProfileOrThrow } from "~server/features/users/service";

import type { Route } from "./+types/users.$userId";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: loaderData ? `${loaderData.username} · KuroBB` : "Perfil · KuroBB" }];
}

export async function loader({ params }: Route.LoaderArgs) {
  return getPublicProfileOrThrow(Number(params.userId));
}

export default function PublicProfile({ loaderData }: Route.ComponentProps) {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6 md:p-8">
      <div className="flex items-center gap-4">
        {loaderData.avatarUrl ? (
          <img
            src={loaderData.avatarUrl}
            alt=""
            width={96}
            height={96}
            className="border border-border"
          />
        ) : null}
        <div>
          <PageHeading>{loaderData.username}</PageHeading>
          <p className="text-sm text-ink-muted">{loaderData.postCount} mensajes</p>
        </div>
      </div>
      {loaderData.signature ? (
        // Signature is raw BBCode source today (§04) — not run through
        // renderBbcodeToHtml anywhere, this pass doesn't change that, only
        // renders it as plain text rather than leaving it unstyled.
        <p className="border-t border-border pt-4 text-sm text-ink-muted">
          {loaderData.signature}
        </p>
      ) : null}
    </main>
  );
}

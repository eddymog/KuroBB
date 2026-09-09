import { Link } from "react-router";

import { PageHeading } from "~/components/ui/PageHeading";

import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "KuroBB" },
    { name: "description", content: "KuroBB — a standalone forum." },
  ];
}

export default function Home() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-6 md:p-8">
      <PageHeading>KuroBB</PageHeading>
      <p>
        <Link to="/forums" className="text-accent">
          Browse the forums
        </Link>
      </p>
    </main>
  );
}

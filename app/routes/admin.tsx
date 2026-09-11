import { Link } from "react-router";

import { PageHeading } from "~/components/ui/PageHeading";
import { requireAdmin } from "~server/features/auth/service";

import type { Route } from "./+types/admin";

export function meta() {
  return [{ title: "Administración · KuroBB" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  return null;
}

export default function AdminDashboard() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-6 md:p-8">
      <PageHeading>Admin</PageHeading>
      <ul className="flex flex-col gap-2">
        <li>
          <Link to="/admin/forums" className="text-accent hover:underline">
            Estructura de foros
          </Link>
        </li>
        <li>
          <Link to="/admin/groups" className="text-accent hover:underline">
            Grupos y permisos
          </Link>
        </li>
      </ul>
      <p className="text-sm text-ink-muted italic">
        Aquí no se muestra el historial de migraciones — todavía no existe un script de
        migración (la Fase 4 está en pausa). Las herramientas de moderación (cola de
        reportes, acciones de baneo/bloqueo) — Fase 5, tampoco construidas aún.
      </p>
    </main>
  );
}

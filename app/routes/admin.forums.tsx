import { Link } from "react-router";

import { PageHeading } from "~/components/ui/PageHeading";
import { Table, Td, Th } from "~/components/ui/Table";
import { requireAdmin } from "~server/features/auth/service";
import { listForumsForAdmin } from "~server/features/admin/service";

import type { Route } from "./+types/admin.forums";

export function meta() {
  return [{ title: "Estructura de foros · Admin · KuroBB" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  const forums = await listForumsForAdmin();
  return { forums };
}

export default function AdminForums({ loaderData }: Route.ComponentProps) {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6 md:p-8">
      <PageHeading>Estructura de foros</PageHeading>
      {loaderData.forums.length === 0 ? (
        <p className="text-ink-muted">
          Aún no hay foros.{" "}
          <Link to="/forums/new" className="text-accent hover:underline">
            Crear un foro
          </Link>
        </p>
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>ID</Th>
                <Th>Nombre</Th>
                <Th>Padre</Th>
                <Th>Posición</Th>
                <Th>Temas</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {loaderData.forums.map((forum) => (
                <tr key={forum.id}>
                  <Td>{forum.id}</Td>
                  <Td>{forum.name}</Td>
                  <Td>{forum.parentId ?? "—"}</Td>
                  <Td>{forum.position}</Td>
                  <Td>{forum.threadCount}</Td>
                  <Td>
                    <Link to={`/admin/forums/${forum.id}/edit`} className="text-accent hover:underline">
                      Editar
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Link to="/forums/new" className="text-accent hover:underline">
            Crear un foro
          </Link>
        </>
      )}
    </main>
  );
}

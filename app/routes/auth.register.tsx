import { Form, redirect } from "react-router";
import { z } from "zod";

import { Button } from "~/components/ui/Button";
import { Field } from "~/components/ui/Field";
import { PageHeading } from "~/components/ui/PageHeading";
import { register } from "~server/features/auth/service";
import { safeParseFormData } from "~server/lib/validation";

import type { Route } from "./+types/auth.register";

export function meta() {
  return [{ title: "Registrarse · KuroBB" }];
}

const schema = z.object({
  username: z.string().min(1, "El nombre de usuario es obligatorio."),
  email: z.string().email("Ingresa una dirección de correo electrónico válida."),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
});

export async function action({ request }: Route.ActionArgs) {
  const result = await safeParseFormData(request, schema);
  if (!result.success) {
    return { fieldErrors: result.fieldErrors };
  }
  // A duplicate username/email is still a service-layer CONFLICT throw, not
  // a Zod-schema failure — consistent with forums.new/etc., only the fields
  // Zod itself can validate get inline display in this pass.
  await register(result.data);
  return redirect("/auth/login");
}

export default function Register({ actionData }: Route.ComponentProps) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center gap-8 p-6">
      <PageHeading>Registrarse</PageHeading>
      <Form method="post" className="flex flex-col gap-4">
        <Field
          name="username"
          label="Nombre de usuario"
          required
          error={actionData?.fieldErrors?.username}
        />
        <Field
          name="email"
          type="email"
          label="Correo electrónico"
          required
          error={actionData?.fieldErrors?.email}
        />
        <Field
          name="password"
          type="password"
          label="Contraseña"
          required
          minLength={8}
          error={actionData?.fieldErrors?.password}
        />
        <Button type="submit">Registrarse</Button>
      </Form>
    </main>
  );
}

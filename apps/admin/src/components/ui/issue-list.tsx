// B-306, B-301: lista bledow i ostrzezen walidatora pod edytorem (kazdy wpis wskazuje miejsce, np. "linia 12").
import { Alert } from "@taktyl/ui";

export interface Issue {
  path: string;
  message: string;
}

export function IssueList({
  id,
  title,
  variant,
  issues,
}: {
  id?: string;
  title: string;
  variant: "blad" | "uwaga";
  issues: Issue[];
}) {
  if (issues.length === 0) return null;
  return (
    <Alert id={id} variant={variant} title={title}>
      <ul className="adm-lista">
        {issues.map((i, n) => (
          <li key={`${i.path}-${n}`}>{i.message}</li>
        ))}
      </ul>
    </Alert>
  );
}

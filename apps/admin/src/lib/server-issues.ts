// B-306, B-301: bledy 422 z API jako lista (wszystkie komunikaty, nie tylko pierwszy) do pokazania pod edytorem.
import { ApiError } from "./api/client";
import type { Issue } from "../components/ui/issue-list";

export function issuesOf(err: unknown): Issue[] {
  if (!(err instanceof ApiError) || err.status !== 422) return [];
  return err.fieldErrors.map((e) => ({ path: e.path, message: e.message }));
}

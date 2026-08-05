import { RequireAuth } from "@/components/require-auth";
import { ChecklistClient } from "./checklist-client";

export default function ChecklistPage() {
  return (
    <RequireAuth>
      <ChecklistClient />
    </RequireAuth>
  );
}

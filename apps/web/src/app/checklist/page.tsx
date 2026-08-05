import { RequireAuth } from "@/components/require-auth";
import { Shell } from "@/components/shell";
import { ChecklistClient } from "./checklist-client";

export default function ChecklistPage() {
  return (
    <RequireAuth>
      <Shell>
        <ChecklistClient />
      </Shell>
    </RequireAuth>
  );
}

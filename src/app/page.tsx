import { Shell } from "@/components/layout/Shell";
import { EmptyState } from "@/components/ui/EmptyState";

export default function HomePage() {
  return (
    <Shell>
      <EmptyState
        title="CCP Confidential Communication Portal"
        description="Select a conversation from the panel to view confidential messages. Communications are isolated and strictly governed by server-side authorization policies."
      />
    </Shell>
  );
}

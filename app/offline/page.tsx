import { CloudOff } from "lucide-react";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="container mx-auto grid min-h-screen max-w-md place-items-center px-4 text-center">
      <div className="space-y-3">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
          <CloudOff className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-semibold">You&apos;re offline</h1>
        <p className="text-sm text-muted-foreground">
          3dfy needs the network to talk to fal.ai. Reconnect and try again.
        </p>
      </div>
    </main>
  );
}

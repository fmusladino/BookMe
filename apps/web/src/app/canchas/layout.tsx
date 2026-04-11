import { Sidebar } from "@/components/layout/sidebar";
import { SubscriptionBanner } from "@/components/layout/subscription-banner";

export default function CanchasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="lg:pl-64">
        <SubscriptionBanner />
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}

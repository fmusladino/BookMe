import { Sidebar } from "@/components/layout/sidebar";
import { SubscriptionBanner } from "@/components/layout/subscription-banner";
import { OnboardingProvider } from "@/components/onboarding/onboarding-provider";

export default function DashboardLayout({
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
      <OnboardingProvider />
    </div>
  );
}

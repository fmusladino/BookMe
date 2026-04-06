"use client";

import { FeaturesContext, useFeaturesLoader } from "@/hooks/use-features";

export function FeaturesProvider({ children }: { children: React.ReactNode }) {
  const features = useFeaturesLoader();

  return (
    <FeaturesContext.Provider value={features}>
      {children}
    </FeaturesContext.Provider>
  );
}

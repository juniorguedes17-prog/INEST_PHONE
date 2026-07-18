export const FEATURES = {
  suppliers: false,
  dashboardBI: false,
  importRadar: false,
  financial: false,
  integrations: false,
} as const;

export type FeatureKey = keyof typeof FEATURES;

export const featureRoutes: Record<FeatureKey, string> = {
  suppliers: '/suppliers',
  dashboardBI: '/bi',
  importRadar: '/import-radar',
  financial: '/finance',
  integrations: '/integrations',
};

export function isFeatureEnabled(feature?: FeatureKey) {
  return !feature || FEATURES[feature];
}

export function isFeatureRouteEnabled(pathname: string) {
  return !Object.entries(featureRoutes).some(
    ([feature, route]) =>
      (pathname === route || pathname.startsWith(`${route}/`)) &&
      !FEATURES[feature as FeatureKey],
  );
}

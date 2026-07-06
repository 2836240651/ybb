import homeSettings from "@/lib/data/home-settings.json";

export type HomeSettingsData = {
  wholesaleCollectionsEnabled: boolean;
  source?: string;
  syncedAt?: string | null;
};

export const homeSettingsData = homeSettings as HomeSettingsData;

export function isWholesaleCollectionsEnabled(): boolean {
  return homeSettingsData.wholesaleCollectionsEnabled !== false;
}

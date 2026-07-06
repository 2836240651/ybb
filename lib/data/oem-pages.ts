/** OEM / ODM pages �?overview plus dedicated sub-page copy. */
export const OEM_OVERVIEW_HANDLES = [
  "oem-odm",
  "private-label",
  "custom-packaging",
  "moq-lead-time",
] as const;

export const OEM_SUB_PAGE_HANDLES = [
  "private-label",
  "custom-packaging",
  "moq-lead-time",
] as const;

export type OemOverviewHandle = (typeof OEM_OVERVIEW_HANDLES)[number];

export function isOemOverviewHandle(handle: string): handle is OemOverviewHandle {
  return (OEM_OVERVIEW_HANDLES as readonly string[]).includes(handle);
}

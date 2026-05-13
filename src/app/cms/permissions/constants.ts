export type PagePermissionEntry = {
  page_path: string;
  label: string;
};

export const PROTECTED_PAGES: PagePermissionEntry[] = [
  { page_path: "/cms/dashboard", label: "Dashboard" },
  { page_path: "/cms/approvals", label: "Booking Approvals" },
  { page_path: "/cms/permissions", label: "Permissions" },
  { page_path: "/cms/history", label: "Booking History" },
  { page_path: "/cms/time-table", label: "Time Table" },
  { page_path: "/cms/test", label: "Test Page" },
];

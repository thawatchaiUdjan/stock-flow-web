import type { UserRole, UserStatus } from "@/api/generated/model";

export const roleNames: Record<UserRole, string> = {
  owner: "Owner",
  admin: "Admin",
  staff: "Staff",
};

export const statusNames: Record<UserStatus, string> = {
  active: "Active",
  inactive: "Inactive",
};

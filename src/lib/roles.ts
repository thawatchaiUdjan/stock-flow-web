import type { UserRole } from "@/api/generated/model";

export const roleNames: Record<UserRole, string> = {
  owner: "Owner",
  admin: "Admin",
  staff: "Staff",
};

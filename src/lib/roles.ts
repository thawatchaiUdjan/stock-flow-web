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

// users-and-access R9, R10: the Owner is made at installation, so only these two are ever chosen.
export const assignableRoles = (["admin", "staff"] as const).map((value) => ({
  value,
  label: roleNames[value],
}));

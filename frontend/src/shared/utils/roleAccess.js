export const ROLE_ACCESS = {
  dashboard: [
    "super-admin",
    "company-admin",
    "hr",
    "manager",
    "employee",
    "intern",
    "sales-representative",
    "freelancer",
    "accountant",
  ],

  users: [
    "super-admin",
    "company-admin",
    "hr",
    "manager",
  ],

  attendance: [
    "super-admin",
    "company-admin",
    "hr",
    "manager",
    "employee",
    "intern",
    "sales-representative",
    "freelancer",
    "accountant",
  ],

  tasks: [
    "super-admin",
    "company-admin",
    "hr",
    "manager",
    "employee",
    "intern",
    "sales-representative",
    "freelancer",
    "accountant",
  ],

  sales: [
    "super-admin",
    "company-admin",
    "hr",
    "manager",
    "sales-representative",
    "accountant",
  ],

  freelancers: [
    "super-admin",
    "company-admin",
    "hr",
    "manager",
    "freelancer",
    "accountant",
  ],

  reports: [
    "super-admin",
    "company-admin",
    "hr",
    "manager",
    "accountant",
  ],

  settings: [
    "super-admin",
    "company-admin",
    "hr",
    "manager",
    "employee",
    "intern",
    "sales-representative",
    "freelancer",
    "accountant",
  ],
};

export function hasModuleAccess(userRole, moduleName) {
  if (!userRole || !moduleName) return false;

  const normalizedRole = String(userRole).trim().toLowerCase();
  const normalizedModule = String(moduleName).trim().toLowerCase();

  const allowedRoles = ROLE_ACCESS[normalizedModule];

  if (!allowedRoles) return false;

  return allowedRoles.includes(normalizedRole);
}
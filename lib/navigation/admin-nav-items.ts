export type AdminNavItem = {
  label: string;
  href: string;
  description: string;
};

export const adminNavItems: AdminNavItem[] = [
  {
    label: "邀请码管理",
    href: "/admin/invitations",
    description: "生成邀请码与邀请链接",
  },
];

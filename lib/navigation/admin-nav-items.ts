export type AdminNavItem = {
  label: string;
  href: string;
  description: string;
};

export const adminNavItems: AdminNavItem[] = [
  {
    label: "模型监控",
    href: "/admin/model-monitor",
    description: "查看模型连续失败次数",
  },
  {
    label: "邀请码管理",
    href: "/admin/invitations",
    description: "生成邀请码与邀请链接",
  },
];

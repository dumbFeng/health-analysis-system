export type AppNavTab = {
  label: string;
  href: string;
  activePathPrefixes: string[];
};

export const appNavTabs: AppNavTab[] = [
  {
    label: "体检报告分析",
    href: "/",
    activePathPrefixes: ["/", "/reports"],
  },
];

import type { ReactNode } from "react";
import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Users } from "lucide-react";

export interface DashboardSidebarItem {
  key: string;
  label: string;
  icon: ReactNode;
  section?: "student" | "personal" | "leader" | "project" | "workspace" | "resources" | "other";
}

interface Props {
  title: string;
  subtitle?: string;
  items: DashboardSidebarItem[];
  activeKey: string;
  onSelect: (key: string) => void;
}

const LEGACY_GROUP_ORDER = ["primary", "secondary"] as const;
type LegacyGroupKey = typeof LEGACY_GROUP_ORDER[number];

function getLegacyGroups(items: DashboardSidebarItem[]): Record<LegacyGroupKey, DashboardSidebarItem[]> {
  const primaryKeys = new Set<string>(["work", "calendar", "overview", "reports"]);

  return items.reduce<Record<LegacyGroupKey, DashboardSidebarItem[]>>(
    (acc, item) => {
      if (primaryKeys.has(item.key)) acc.primary.push(item);
      else acc.secondary.push(item);
      return acc;
    },
    { primary: [], secondary: [] },
  );
}

function getLegacyGroupLabel(groupKey: LegacyGroupKey): string {
  if (groupKey === "primary") return "Workspace";
  return "Quan tri";
}

function getSectionLabel(section: DashboardSidebarItem["section"] | undefined): string {
  if (section === "workspace") return "Workspace";
  if (section === "leader") return "Quản lý nhóm";
  if (section === "resources") return "Tài liệu";
  if (section === "other") return "Khác";
  if (section === "project") return "Du an";
  if (section === "personal") return "Ca nhan";
  return "Sinh vien";
}

const DashboardSidebar = ({ title, subtitle, items, activeKey, onSelect }: Props) => {
  const { isMobile, setOpenMobile } = useSidebar();
  const hasCustomSections = items.some(item => item.section);
  const sectionOrder = Array.from(new Set(items.map(item => item.section || "student")));
  const legacyGroups = hasCustomSections ? null : getLegacyGroups(items);

  return (
    <>
      <SidebarHeader className="gap-2">
        <div className="flex items-center gap-2 rounded-lg bg-sidebar-accent/40 px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground shadow-sm">
            <Users className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-2">
              <div className="font-display truncate text-sm font-semibold">TEAMFAIR</div>
              <span className="rounded-full bg-sidebar-accent px-2 py-0.5 text-[11px] font-medium text-sidebar-accent-foreground">
                {title}
              </span>
            </div>
            <div className="truncate text-xs text-sidebar-foreground/70">{subtitle || "Workspace"}</div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        {hasCustomSections
          ? sectionOrder.map((section, idx) => {
              const groupItems = items.filter(item => (item.section || "student") === section);
              if (groupItems.length === 0) return null;

              return (
                <SidebarGroup key={section}>
                  <SidebarGroupLabel>{getSectionLabel(section)}</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {groupItems.map(item => (
                        <SidebarMenuItem key={item.key}>
                          <SidebarMenuButton
                            isActive={activeKey === item.key}
                            tooltip={item.label}
                            className="relative overflow-hidden rounded-lg data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:shadow-sm"
                            onClick={() => {
                              onSelect(item.key);
                              if (isMobile) setOpenMobile(false);
                            }}
                          >
                            <span className="flex items-center justify-center">{item.icon}</span>
                            <span>{item.label}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                  {idx < sectionOrder.length - 1 ? <SidebarSeparator /> : null}
                </SidebarGroup>
              );
            })
          : LEGACY_GROUP_ORDER.map((groupKey, idx) => {
              const groupItems = legacyGroups?.[groupKey] || [];
              if (groupItems.length === 0) return null;

              return (
                <SidebarGroup key={groupKey}>
                  <SidebarGroupLabel>{getLegacyGroupLabel(groupKey)}</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {groupItems.map(item => (
                        <SidebarMenuItem key={item.key}>
                          <SidebarMenuButton
                            isActive={activeKey === item.key}
                            tooltip={item.label}
                            className="relative overflow-hidden rounded-lg data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:shadow-sm"
                            onClick={() => {
                              onSelect(item.key);
                              if (isMobile) setOpenMobile(false);
                            }}
                          >
                            <span className="flex items-center justify-center">{item.icon}</span>
                            <span>{item.label}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                  {idx === 0 ? <SidebarSeparator /> : null}
                </SidebarGroup>
              );
            })}
      </SidebarContent>

      <SidebarFooter>
        <div className="px-2 py-1 text-[11px] text-sidebar-foreground/70">Ctrl/Cmd + B de toggle</div>
      </SidebarFooter>
    </>
  );
};

export default DashboardSidebar;

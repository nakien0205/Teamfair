import type { ReactNode } from "react";
import { Sidebar, SidebarInset, SidebarProvider, SidebarRail } from "@/components/ui/sidebar";

interface Props {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
}

const DashboardShell = ({ sidebar, header, children }: Props) => {
  return (
    <SidebarProvider defaultOpen>
      <Sidebar side="left" variant="inset" collapsible="icon">
        {sidebar}
      </Sidebar>
      <SidebarRail />
      <SidebarInset>
        {header}
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
};

export default DashboardShell;

import type { ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface DashboardTabItem {
  value: string;
  label: string;
}

interface Props {
  defaultValue: string;
  tabs: DashboardTabItem[];
  children: ReactNode;
}

const DashboardTabs = ({ defaultValue, tabs, children }: Props) => {
  return (
    <Tabs defaultValue={defaultValue}>
      <TabsList className="w-full justify-start flex-wrap h-auto">
        {tabs.map(t => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
};

export default DashboardTabs;

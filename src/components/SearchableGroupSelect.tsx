import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

import type { Group } from "@/context/TeamContext";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type SearchableGroupSelectProps = {
  groups: Group[];
  value: string;
  onChange: (groupId: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
};

export function SearchableGroupSelect({
  groups,
  value,
  onChange,
  placeholder = "Chọn nhóm",
  searchPlaceholder = "Tìm nhóm...",
  emptyText = "Không tìm thấy nhóm phù hợp.",
  className,
  disabled = false,
}: SearchableGroupSelectProps) {
  const [open, setOpen] = useState(false);

  const selectedGroup = useMemo(
    () => groups.find(group => group.id === value) ?? null,
    [groups, value],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-auto w-full justify-between gap-3 rounded-2xl border-border/70 bg-background px-4 py-3 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
              <Search className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">
                {selectedGroup?.name || placeholder}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {selectedGroup ? `#${selectedGroup.id.slice(0, 8)}` : "Tìm và chọn nhóm nhanh hơn"}
              </span>
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup heading="Nhóm">
              {groups.map(group => (
                <CommandItem
                  key={group.id}
                  value={`${group.name} ${group.id}`}
                  onSelect={() => {
                    onChange(group.id);
                    setOpen(false);
                  }}
                  className="flex items-start gap-3 px-3 py-3"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-semibold text-slate-700">
                    {group.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{group.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      #{group.id.slice(0, 8)} · {group.members.length} thành viên
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default SearchableGroupSelect;

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Search,
  Check,
  ChevronDown,
  ChevronRight,
  Package,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ASSET_GROUPS,
  type AssetGroup,
  type AssetItem,
} from "@/services/assetMaster";

interface ItemGroupSelectorProps {
  value: string;
  onChange: (code: string, label: string) => void;
  error?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

export function ItemGroupSelector({
  value,
  onChange,
  error,
  placeholder = "Select asset group and item type",
  disabled = false,
}: ItemGroupSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [activeIndex, setActiveIndex] = useState(-1);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const selectedGroup = useMemo(() => {
    if (!value) return null;
    for (const g of ASSET_GROUPS) {
      for (const it of g.items) {
        if (it.code === value) return it;
      }
    }
    return null;
  }, [value]);

  const matchedGroups = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return ASSET_GROUPS;
    return ASSET_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter(
        (it) =>
          it.code.toLowerCase().includes(q) ||
          it.name.toLowerCase().includes(q) ||
          g.name.toLowerCase().includes(q),
      ),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  const flatVisibleItems = useMemo(() => {
    const items: { group: AssetGroup; item: AssetItem }[] = [];
    for (const g of matchedGroups) {
      if (expandedGroups.has(g.code)) {
        for (const it of g.items) {
          items.push({ group: g, item: it });
        }
      }
    }
    return items;
  }, [matchedGroups, expandedGroups]);

  const totalVisibleCount = flatVisibleItems.length;

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(-1);
    }
  }, [open]);

  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus();
    }
  }, [open]);

  const toggleGroup = useCallback(
    (code: string) => {
      setExpandedGroups((prev) => {
        const next = new Set(prev);
        if (next.has(code)) {
          next.delete(code);
        } else {
          next.add(code);
        }
        return next;
      });
      setActiveIndex(-1);
    },
    [],
  );

  const selectItem = useCallback(
    (item: AssetItem) => {
      onChange(item.code, `${item.code}: ${item.name}`);
      setOpen(false);
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) return;

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          setOpen(false);
          triggerRef.current?.focus();
          break;

        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((prev) => Math.min(prev + 1, totalVisibleCount - 1));
          break;

        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((prev) => Math.max(prev - 1, 0));
          break;

        case "Enter":
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < flatVisibleItems.length) {
            selectItem(flatVisibleItems[activeIndex].item);
          }
          break;

        case "Tab":
          setOpen(false);
          break;
      }
    },
    [open, activeIndex, totalVisibleCount, flatVisibleItems, selectItem],
  );

  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const el = listRef.current.querySelector(
        `[data-flat-index="${activeIndex}"]`,
      );
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const [panelAbove, setPanelAbove] = useState(false);

  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setPanelAbove(spaceBelow < 420);
    }
  }, [open]);

  const highlightMatch = (text: string, q: string) => {
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-primary/15 text-primary rounded-sm px-0.5">
          {text.slice(idx, idx + q.length)}
        </mark>
        {text.slice(idx + q.length)}
      </>
    );
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm",
          "transition-all duration-200",
          "hover:border-primary/40 hover:ring-2 hover:ring-primary/10",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          open && "border-primary/50 ring-2 ring-primary/15",
          error &&
            "border-destructive focus-visible:ring-destructive/40",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={error}
      >
        <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span
          className={cn(
            "flex-1 text-left truncate",
            selectedGroup ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {selectedGroup
            ? `${selectedGroup.code}: ${selectedGroup.name}`
            : placeholder}
        </span>
        {selectedGroup && !disabled && (
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              onChange("", "");
            }}
            className="ml-1 rounded-sm p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          ref={panelRef}
          onKeyDown={handleKeyDown}
          className={cn(
            "absolute left-0 z-50 w-[calc(100vw-2rem)] sm:w-[480px] md:w-[520px]",
            "rounded-xl border border-border/60 bg-popover shadow-2xl shadow-black/15",
            "overflow-hidden",
            "animate-in fade-in-0 zoom-in-95",
            "top-full mt-2 origin-top",
          )}
          style={{ maxHeight: "min(420px, 50vh)" }}
        >
          <div className="border-b border-border/40 bg-muted/30 px-3 py-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(-1);
                }}
                placeholder="Search by name or code..."
                className="h-9 w-full rounded-lg border border-border/40 bg-background pl-9 pr-8 text-sm placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/15 transition-colors"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    searchRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="mt-1.5 flex items-center justify-between px-0.5">
              <span className="text-[11px] text-muted-foreground">
                {totalVisibleCount} item{totalVisibleCount !== 1 ? "s" : ""}{" "}
                {query ? "matching" : "in expanded groups"}
              </span>
              <button
                type="button"
                onClick={() => {
                  const allExpanded = matchedGroups.every((g) =>
                    expandedGroups.has(g.code),
                  );
                  if (allExpanded) {
                    setExpandedGroups(new Set());
                  } else {
                    setExpandedGroups(
                      new Set(matchedGroups.map((g) => g.code)),
                    );
                  }
                  setActiveIndex(-1);
                }}
                className="text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
              >
                {matchedGroups.every((g) => expandedGroups.has(g.code))
                  ? "Collapse all"
                  : "Expand all"}
              </button>
            </div>
          </div>

          <div
            ref={listRef}
            className="overflow-y-auto overscroll-contain"
            style={{ maxHeight: "min(360px, 50vh)" }}
            role="listbox"
          >
            {matchedGroups.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Package className="mb-2 h-8 w-8 opacity-40" />
                <p className="text-sm font-medium">No items found</p>
                <p className="text-xs mt-0.5">Try a different search term</p>
              </div>
            )}

            {matchedGroups.map((group) => {
              const isExpanded = expandedGroups.has(group.code);
              const selectedInGroup = group.items.some(
                (it) => it.code === value,
              );

              return (
                <div key={group.code} className="border-b border-border/30 last:border-0">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.code)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold transition-colors",
                      "hover:bg-muted/60",
                      "focus-visible:outline-none focus-visible:bg-muted/60",
                      selectedInGroup
                        ? "text-primary"
                        : "text-foreground",
                    )}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="flex-1 truncate">
                      <span className="text-muted-foreground font-normal mr-1.5">
                        {group.code}
                      </span>
                      {group.name}
                    </span>
                    <span className="text-[11px] tabular-nums text-muted-foreground bg-muted/80 rounded-full px-1.5 py-0.5 font-medium">
                      {group.items.length}
                    </span>
                    {selectedInGroup && (
                      <Check className="h-3.5 w-3.5 text-primary" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="bg-muted/20">
                      {group.items.map((item, idx) => {
                        const isSelected = item.code === value;
                        const flatIdx = (() => {
                          let i = 0;
                          for (const g of matchedGroups) {
                            if (g.code === group.code) {
                              for (let j = 0; j < idx; j++) {
                                if (expandedGroups.has(g.code)) i++;
                              }
                              return i;
                            }
                            if (expandedGroups.has(g.code)) i += g.items.length;
                          }
                          return 0;
                        })();
                        const isActive = flatIdx === activeIndex;

                        return (
                          <button
                            key={item.code}
                            type="button"
                            data-flat-index={flatIdx}
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => selectItem(item)}
                            onMouseEnter={() => setActiveIndex(flatIdx)}
                              className={cn(
                                "flex w-full items-center gap-2.5 pl-10 pr-3 py-2 text-left text-sm transition-all duration-150",
                                "focus-visible:outline-none",
                                isSelected
                                  ? "bg-blue-600 text-white font-medium"
                                  : isActive
                                    ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 font-medium"
                                    : "text-foreground hover:bg-blue-500/10 hover:text-blue-700 dark:hover:text-blue-300",
                              )}
                            >
                              <span
                                className={cn(
                                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                                  isSelected
                                    ? "border-white bg-white text-blue-600"
                                    : isActive
                                      ? "border-blue-500 bg-blue-500/20"
                                      : "border-border",
                                )}
                              >
                                {isSelected && <Check className="h-2.5 w-2.5" />}
                              </span>
                              <span className="flex-1 truncate">
                                <span className={cn("font-mono text-[11px] mr-2", isSelected ? "text-blue-100" : "text-muted-foreground")}>
                                  {highlightMatch(item.code, query)}
                                </span>
                                {highlightMatch(item.name, query)}
                              </span>
                              {selectedGroup?.code === item.code && (
                                <span className={cn("text-[10px] font-medium rounded px-1.5 py-0.5", isSelected ? "bg-blue-500 text-white" : "text-blue-600 bg-blue-500/10")}>
                                  Current
                                </span>
                              )}
                            </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

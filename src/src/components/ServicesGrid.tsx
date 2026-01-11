import { AnimatePresence } from "framer-motion";
import { ServiceCard } from "./ServiceCard";
import type { Monitor } from "../types";

interface ServicesGridProps {
  monitors: Monitor[];
  selectedMonitor: Monitor | null;
  onSelectMonitor: (monitor: Monitor | null) => void;
}

export function ServicesGrid({ monitors, selectedMonitor, onSelectMonitor }: ServicesGridProps) {
  return (
    <>
      {/* Mobile/Tablet: Compact list */}
      <div className="lg:hidden space-y-2">
        <AnimatePresence>
          {monitors.map((monitor, index) => {
            const isSelected = selectedMonitor !== null && String(selectedMonitor.id) === String(monitor.id);
            return (
              <ServiceCard
                key={monitor.id}
                monitor={monitor}
                isSelected={isSelected}
                onClick={() => onSelectMonitor(isSelected ? null : monitor)}
                index={index}
                variant="row"
              />
            );
          })}
        </AnimatePresence>
      </div>

      {/* Desktop: Table-like list */}
      <div className="hidden lg:block space-y-2">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-slate-200">Monitors</div>
          <div className="text-xs text-slate-300/60 tabular-nums">{monitors.length} total</div>
        </div>
        <div className="grid grid-cols-[1fr] gap-2">
          <div className="hidden xl:grid grid-cols-[1fr_90px_90px_120px_24px] px-3 text-[11px] text-slate-300/60 uppercase tracking-wider">
            <div>Name</div>
            <div className="text-right">Uptime</div>
            <div className="text-right">Latency</div>
            <div className="text-right">Last check</div>
            <div />
          </div>
          <AnimatePresence>
            {monitors.map((monitor, index) => {
              const isSelected = selectedMonitor !== null && String(selectedMonitor.id) === String(monitor.id);
              return (
                <ServiceCard
                  key={monitor.id}
                  monitor={monitor}
                  isSelected={isSelected}
                  onClick={() => onSelectMonitor(isSelected ? null : monitor)}
                  index={index}
                  variant="row"
                />
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}


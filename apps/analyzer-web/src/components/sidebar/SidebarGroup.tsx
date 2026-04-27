import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SidebarGroupProps {
  title: string;
  children: React.ReactNode;
  collapsed: boolean;
}

export const SidebarGroup = ({
  title,
  children,
  collapsed,
}: SidebarGroupProps) => {
  const [open, setOpen] = useState(true);

  if (collapsed) {
    return (
      <div className="flex flex-col gap-1 items-center py-1">{children}</div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="space-y-1">
      <CollapsibleTrigger className="flex items-center justify-between w-full text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2 hover:bg-muted/50 rounded-md transition-colors">
        <span>{title}</span>
        <motion.div
          animate={{ rotate: open ? 0 : -90 }}
          transition={{ duration: 0.15 }}
        >
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </CollapsibleTrigger>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
          >
            <CollapsibleContent className="space-y-1 pl-2 overflow-hidden">
              {children}
            </CollapsibleContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Collapsible>
  );
};

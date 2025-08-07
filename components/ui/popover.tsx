"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

// A simplified popover implementation that doesn't rely on Radix UI
const PopoverContext = React.createContext<{
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}>({
  open: false,
  setOpen: () => {},
  triggerRef: React.createRef<HTMLButtonElement | null>(),
});

const Popover = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);

  return (
    <PopoverContext.Provider value={{ open, setOpen, triggerRef }}>
      <div className="relative inline-block">{children}</div>
    </PopoverContext.Provider>
  );
};

interface PopoverTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

const PopoverTrigger = React.forwardRef<
  HTMLButtonElement,
  PopoverTriggerProps
>(({ className, asChild = false, children, ...props }, forwardedRef) => {
  const { open, setOpen, triggerRef } = React.useContext(PopoverContext);
  const combinedRef = React.useCallback((node: HTMLButtonElement | null) => {
    triggerRef.current = node;
    if (typeof forwardedRef === 'function') {
      forwardedRef(node);
    } else if (forwardedRef) {
      forwardedRef.current = node;
    }
  }, [forwardedRef, triggerRef]);

  // If asChild is true and children is a valid element, clone it
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      ref: combinedRef,
      onClick: (e: React.MouseEvent) => {
        // Cast to any to avoid type errors with unknown props
        const childProps = (children as any).props;
        if (childProps && typeof childProps.onClick === 'function') {
          childProps.onClick(e);
        }
        setOpen(!open);
      },
      ...props,
    });
  }

  return (
    <button
      ref={combinedRef}
      type="button"
      className={className}
      onClick={() => setOpen(!open)}
      {...props}
    >
      {children}
    </button>
  );
});
PopoverTrigger.displayName = "PopoverTrigger";

interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "center" | "start" | "end";
  sideOffset?: number;
}

const PopoverContent = React.forwardRef<
  HTMLDivElement,
  PopoverContentProps
>(({ className, align = "center", sideOffset = 4, ...props }, forwardedRef) => {
  const { open, triggerRef } = React.useContext(PopoverContext);
  const [position, setPosition] = React.useState({ top: 0, left: 0 });
  const contentRef = React.useRef<HTMLDivElement>(null);
  const combinedRef = React.useCallback((node: HTMLDivElement | null) => {
    contentRef.current = node;
    if (typeof forwardedRef === 'function') {
      forwardedRef(node);
    } else if (forwardedRef) {
      forwardedRef.current = node;
    }
  }, [forwardedRef]);

  // Position the content relative to the trigger
  React.useEffect(() => {
    if (open && triggerRef.current && contentRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const contentRect = contentRef.current.getBoundingClientRect();
      
      let top = triggerRect.bottom + sideOffset + window.scrollY;
      let left = 0;
      
      switch (align) {
        case "start":
          left = triggerRect.left + window.scrollX;
          break;
        case "end":
          left = triggerRect.right - contentRect.width + window.scrollX;
          break;
        case "center":
        default:
          left = triggerRect.left + (triggerRect.width / 2) - (contentRect.width / 2) + window.scrollX;
          break;
      }
      
      setPosition({ top, left });
    }
  }, [open, align, sideOffset, triggerRef]);

  if (!open) return null;

  return (
    <div
      ref={combinedRef}
      className={cn(
        "absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-white p-4 text-gray-800 shadow-md",
        "animate-in fade-in-0 zoom-in-95",
        className
      )}
      style={{ 
        top: `${position.top}px`, 
        left: `${position.left}px` 
      }}
      {...props}
    />
  );
});
PopoverContent.displayName = "PopoverContent";

export { Popover, PopoverTrigger, PopoverContent }; 
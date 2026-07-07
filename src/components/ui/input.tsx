import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-[14px] border border-white/6 bg-[hsl(222_35%_9%)] px-4 py-3 text-base text-foreground placeholder:text-[hsl(215_18%_50%)] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground focus-visible:outline-none focus-visible:border-[rgba(215,180,106,.35)] focus-visible:ring-2 focus-visible:ring-[rgba(215,180,106,.14)] disabled:cursor-not-allowed disabled:opacity-50 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,.35)] sm:h-[44px] sm:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 active:scale-98",
  {
    variants: {
      variant: {
        default: "btn-gold",
        destructive: "rounded-[14px] border border-[rgba(255,107,107,.25)] bg-[rgba(255,107,107,.12)] text-[hsl(0_100%_82%)] hover:bg-[rgba(255,107,107,.16)]",
        outline: "rounded-[14px] border border-white/8 bg-[hsl(222_35%_9%)] text-foreground hover:bg-[hsl(223_30%_14%)] hover:border-[rgba(215,180,106,.2)]",
        secondary: "rounded-[14px] border border-white/8 bg-transparent text-[hsl(215_18%_72%)] hover:bg-[hsl(223_30%_14%)] hover:text-foreground",
        ghost: "rounded-[14px] bg-transparent text-[hsl(215_18%_72%)] hover:bg-[hsl(223_30%_14%)] hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-12 px-5 py-2.5",
        sm: "h-10 px-4",
        lg: "h-12 px-6",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants };

import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      // A field is flat glass (.glass-control draws the fill, the hairline and
      // the gold focus ring); no Tailwind border or ring here, they would win
      // over the class and hide the focus state. 16px text on phones so iOS
      // does not zoom into the field.
      className={cn(
        "glass-control h-9 w-full min-w-0 rounded-xl px-3 py-1 text-base text-foreground outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 pointer-coarse:h-11 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }

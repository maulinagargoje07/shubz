import { isValidElement } from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // The one gold thing on a screen: .btn-gold lights the face, darkens
        // the text and runs a sheen across it once on hover.
        default: "btn-gold rounded-xl border-0 text-primary-foreground",
        // Flat glass. The base's transparent border would win over the
        // class's hairline, so the rim colour is restated here.
        outline:
          "glass-tint rounded-xl border-glass-rim text-foreground hover:bg-glass-hover aria-expanded:bg-glass-hover",
        secondary:
          "glass-tint rounded-xl border-glass-rim text-secondary-foreground hover:bg-glass-hover hover:text-foreground aria-expanded:bg-glass-hover aria-expanded:text-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/**
 * Does this `render` prop produce an actual <button>?
 *
 * Base UI's `nativeButton` defaults to true, and it warns when the rendered
 * element turns out not to be a button — which is the case for every
 * `render={<Link/>}` (an anchor), `render={<a/>}` and `render={<label/>}` in
 * this app. Answering the question here, once, is far better than repeating
 * `nativeButton={false}` at thirty call sites and forgetting it at the
 * thirty-first.
 *
 * Only an intrinsic `"button"` element counts. A component (`Link`, or any
 * custom one) is opaque from here — we cannot know what it renders — so the
 * safe answer is "not a native button", which is exactly what Base UI needs to
 * be told to stop assuming otherwise.
 */
function rendersNativeButton(render: unknown): boolean {
  if (render == null) return true // no override: Base UI renders its own <button>
  if (isValidElement(render)) return render.type === "button"
  return false // a render function; its output is unknown from here
}

function Button({
  className,
  variant = "default",
  size = "default",
  nativeButton,
  render,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      // An explicit prop always wins; otherwise infer it from `render`.
      nativeButton={nativeButton ?? rendersNativeButton(render)}
      render={render}
      {...props}
    />
  )
}

export { Button, buttonVariants }

"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

export type DialogSize = "default" | "sm" | "md" | "lg" | "xl" | "wide" | "full"

const sizeClasses: Record<DialogSize, string> = {
  sm: "sm:max-w-sm max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)]",
  default: "sm:max-w-lg max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)]",
  md: "sm:max-w-lg max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)]",
  lg: "sm:max-w-2xl max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)]",
  xl: "sm:max-w-4xl max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)] flex flex-col p-0 overflow-hidden",
  wide: "sm:max-w-[1080px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)] flex flex-col p-0 overflow-hidden",
  full: "sm:max-w-7xl max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)] flex flex-col p-0 overflow-hidden",
}

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/40 backdrop-blur-xs duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

export interface DialogContentProps extends DialogPrimitive.Popup.Props {
  showCloseButton?: boolean
  size?: DialogSize
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  size = "default",
  ...props
}: DialogContentProps) {
  const classNameStr = typeof className === "string" ? className : ""
  const hasCustomWidth = /(max-w-|w-)/.test(classNameStr)
  const isStructuredLayout =
    size === "wide" ||
    size === "xl" ||
    size === "full" ||
    classNameStr.includes("p-0")

  const resolvedSizeClass =
    size !== "default"
      ? sizeClasses[size]
      : hasCustomWidth
      ? "max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)]"
      : sizeClasses.default

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2 rounded-xl bg-popover text-sm text-popover-foreground shadow-2xl ring-1 ring-foreground/10 duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          !isStructuredLayout && "gap-4 p-5 sm:p-6 overflow-y-auto",
          resolvedSizeClass,
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-3.5 right-4 z-20 h-7 w-7 rounded-md p-0 text-muted-foreground hover:bg-muted hover:text-foreground flex items-center justify-center cursor-pointer"
                size="icon"
              />
            }
          >
            <XIcon className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1.5 shrink-0", className)}
      {...props}
    />
  )
}

function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn("flex-1 min-h-0 overflow-y-auto px-6 py-4", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 shrink-0 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "text-base leading-none font-semibold text-foreground",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-xs text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogBody,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}

"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "p-3",
        className
      )}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-3",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-semibold tracking-[0.3px] text-gray-800",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-7 w-7 bg-white/60 backdrop-blur-md rounded-full border border-white/50 shadow-sm hover:bg-white hover:text-primary p-0 opacity-70 hover:opacity-100 transition-all"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex justify-between",
        head_cell:
          "text-gray-500 rounded-md w-[34px] font-medium text-[0.7rem] uppercase tracking-wider",
        row: "flex w-full mt-1 justify-between",
        cell: "h-[34px] w-[34px] text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-transparent [&:has([aria-selected])]:bg-transparent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-[34px] w-[34px] p-0 font-normal rounded-full hover:bg-[rgba(120,150,255,0.12)] active:scale-95 transition-all text-gray-700"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-[linear-gradient(135deg,#3b82f6,#8b5cf6)] !text-white hover:bg-primary shadow-[0_4px_12px_rgba(59,130,246,0.4)] !rounded-[10px]",
        day_today: "bg-accent/50 text-accent-foreground font-semibold",
        day_outside:
          "day-outside text-gray-400 opacity-50 aria-selected:bg-transparent aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ...props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ...props }) => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
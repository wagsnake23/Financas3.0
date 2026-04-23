"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, DropdownProps } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = false,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 w-full", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 w-full justify-center",
        month: "space-y-4 w-full",
        caption: "flex justify-center pt-1 relative items-center h-10",
        caption_label: "text-sm font-medium hidden",
        caption_dropdowns: "flex justify-center gap-1 z-10",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          "flex items-center justify-center h-7 w-7 p-0 bg-gradient-to-b from-gray-100 to-gray-200/60 border border-gray-300/40 shadow-[0_2px_4px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] !rounded-xl opacity-90 hover:opacity-100 hover:bg-gray-200/80 transition-all active:scale-95 active:shadow-inner"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse",
        head_row: "flex justify-center gap-0.5 mb-1.5",
        row: "flex w-full justify-center gap-0.5 mt-0.5",
        cell: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground"
        ),
        day_selected:
          "bg-[linear-gradient(135deg,#3b82f6,#8b5cf6)] text-white hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground !rounded-[10px]",
        day_today: "bg-blue-50 text-blue-600 font-semibold rounded-[6px]",
        day_outside: "text-muted-foreground opacity-50",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Dropdown: ({ value, onChange, children, ...props }: DropdownProps) => {
          const options = React.Children.toArray(children) as React.ReactElement<
            React.HTMLProps<HTMLOptionElement>
          >[]
          const selected = options.find((child) => child.props.value === value)
          const handleChange = (value: string) => {
            const changeEvent = {
              target: { value },
            } as React.ChangeEvent<HTMLSelectElement>
            onChange?.(changeEvent)
          }

          // Helper para capitalizar apenas se for string
          const formatLabel = (label: any) => {
            if (typeof label === "string" && isNaN(Number(label))) {
              return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
            }
            return label;
          };

          return (
            <Select
              value={value?.toString()}
              onValueChange={(value) => {
                handleChange(value)
              }}
            >
              <SelectTrigger className="h-8 pr-2 pl-3 py-1 font-medium bg-transparent border-none focus:ring-0 focus:ring-offset-0 hover:bg-accent/50 transition-colors gap-1 rounded-lg">
                <SelectValue>{formatLabel(selected?.props.children)}</SelectValue>
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-[300px] rounded-xl border-slate-200/60 shadow-xl">
                <ScrollArea className="h-full">
                  {options.map((option, id: number) => (
                    <SelectItem
                      key={`${option.props.value}-${id}`}
                      value={option.props.value?.toString() ?? ""}
                      className="rounded-lg py-1.5 focus:bg-blue-50 focus:text-blue-600 transition-colors"
                    >
                      {formatLabel(option.props.children)}
                    </SelectItem>
                  ))}
                </ScrollArea>
              </SelectContent>
            </Select>
          )
        },
        Head: () => {
          const days = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
          return (
            <thead>
              <tr className="flex justify-center gap-0.5 mb-1.5">
                {days.map((day, i) => {
                  const isWeekend = i === 0 || i === 6;
                  return (
                    <th
                      key={i}
                      className={cn(
                        "rounded-md w-9 text-[0.75rem] text-center uppercase transition-colors",
                        isWeekend 
                          ? "text-red-500 font-black" 
                          : "text-gray-500 font-semibold"
                      )}
                    >
                      {day}
                    </th>
                  );
                })}
              </tr>
            </thead>
          );
        },
        IconLeft: ({ ...props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ...props }) => <ChevronRight className="h-4 w-4" />,
      }}
      modifiers={{
        sunday: (date) => date.getDay() === 0,
        saturday: (date) => date.getDay() === 6,
      }}
      modifiersClassNames={{
        sunday: "bg-red-50/50 text-red-600 font-medium !rounded-[6px]",
        saturday: "bg-red-50/50 text-red-600 font-medium !rounded-[6px]",
      }}
      captionLayout="dropdown-buttons"
      fromYear={1900}
      toYear={2100}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
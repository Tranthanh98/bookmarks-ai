import { Cross2Icon } from "@radix-ui/react-icons"
import * as Popover from "@radix-ui/react-popover"
import * as React from "react"

import "./styles.css"

interface PopoverUIProps {
  triggerElement: React.ReactNode
  children: React.ReactNode
}

const PopoverUI = ({ triggerElement, children }: PopoverUIProps) => (
  <Popover.Root>
    <Popover.Trigger asChild>{triggerElement}</Popover.Trigger>
    <Popover.Portal>
      <Popover.Content className="PopoverContent" sideOffset={5}>
        {children}
        <Popover.Close className="PopoverClose" aria-label="Close">
          <Cross2Icon />
        </Popover.Close>
        <Popover.Arrow className="PopoverArrow" />
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>
)

export default PopoverUI

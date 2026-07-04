import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@repo/ui/components/accordion'

export function ExpandableSection({
  children,
  title,
}: {
  children: React.ReactNode
  title: string
}) {
  return (
    <Accordion
      type="single"
      collapsible
      className="italic bg-muted text-muted-foreground overflow-auto"
    >
      <AccordionItem value={title}>
        <AccordionTrigger className="py-1">{title}</AccordionTrigger>
        <AccordionContent>{children}</AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

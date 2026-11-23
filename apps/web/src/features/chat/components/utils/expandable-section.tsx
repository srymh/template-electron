import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@repo/ui/components/accordion'

/** チャットの補足情報を、開閉可能な見出しの下に表示する。 */
export function ExpandableSection({
  children,
  title,
}: {
  children: React.ReactNode
  title: string
}) {
  return (
    <Accordion className="bg-muted text-muted-foreground overflow-auto italic">
      <AccordionItem value={title}>
        <AccordionTrigger className="py-1">{title}</AccordionTrigger>
        <AccordionContent>{children}</AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

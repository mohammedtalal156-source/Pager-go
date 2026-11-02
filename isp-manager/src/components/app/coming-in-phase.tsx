import { Construction } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/** Honest placeholder for sections scheduled in a later phase (no fake data). */
export function ComingInPhase({ phase, items }: { phase: number; items: string[] }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
        <Construction className="size-10 text-warning" />
        <p className="font-semibold">هذا القسم يُبنى في المرحلة {phase}</p>
        <ul className="text-sm text-muted-foreground">
          {items.map((i) => (
            <li key={i}>• {i}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

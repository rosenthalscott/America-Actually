import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function HowToRead() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          How to read
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>How to read a purple map</DialogTitle>
          <DialogDescription>
            Most election maps pick a winner and paint the whole place that color. A 51–49
            county looks the same as a 90–10 county. That is winner-takes-all.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm leading-relaxed text-foreground">
          <p>
            <span className="font-medium">Blend</span> mixes the two party colors by their
            actual share. A toss-up is purple. A landslide leans red or blue. The map stops
            pretending the country is two solid blocks.
          </p>
          <p>
            <span className="font-medium">Winner</span> is the familiar red/blue quilt — the
            same votes, a harsher story.
          </p>
          <p>
            <span className="font-medium">Margin</span> keeps the mix but fades places where
            the race was close, so landslides read louder.
          </p>
          <p className="text-muted-foreground">
            Polarize pushes a blend toward the winner without snapping to a single color.
            Plug in any GeoJSON + vote table to run the same coloring on another contest.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

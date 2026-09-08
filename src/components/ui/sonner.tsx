import { Toaster as Sonner } from "sonner";

function Toaster() {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast bg-card text-foreground border-border shadow-border font-sans",
          title: "text-foreground",
          description: "text-muted-foreground",
        },
      }}
    />
  );
}

export { Toaster };

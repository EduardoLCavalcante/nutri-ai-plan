import { useRef, useState } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const PortfolioDisclaimer = () => {
  const [isOpen, setIsOpen] = useState(true);
  const actionRef = useRef<HTMLButtonElement>(null);

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent
        className="max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border-border/70 p-6 shadow-card sm:rounded-2xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          actionRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          document.querySelector<HTMLElement>('main')?.focus();
        }}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <AlertDialogHeader className="space-y-3 text-left">
          <div className="gradient-primary flex h-12 w-12 items-center justify-center rounded-xl shadow-glow">
            <AlertTriangle className="h-6 w-6 text-primary-foreground" aria-hidden="true" />
          </div>
          <AlertDialogTitle className="font-display text-2xl font-bold text-foreground">
            Aviso importante
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left text-sm leading-6 text-muted-foreground">
            O site tem fins de portfólio, com intuito apenas de demonstrar o uso de uma API de IA por meio de uma interface web. Seus resultados não devem ser considerados como conselhos nutricionais reais. Para isso, consulte um nutricionista formado.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-2">
          <AlertDialogAction
            ref={actionRef}
            className="gradient-primary w-full font-semibold text-primary-foreground shadow-soft hover:shadow-glow sm:w-auto"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Entendi
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default PortfolioDisclaimer;

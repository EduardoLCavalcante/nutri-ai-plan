import { AlertTriangle, Heart } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="border-t border-border/50 bg-muted/30">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col items-center gap-4">
          {/* Disclaimer */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-secondary/50 border border-border/50 max-w-2xl">
            <AlertTriangle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground text-center">
              <strong className="text-foreground">Aviso Legal:</strong> Este aplicativo é apenas para fins educacionais 
              e não substitui um nutricionista profissional. Consulte sempre um especialista 
              para orientações personalizadas.
            </p>
          </div>

          {/* Credits */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Feito com</span>
            <Heart className="h-4 w-4 text-destructive fill-destructive" />
            <span>para fins acadêmicos</span>
          </div>

          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Nutri AI - Projeto Educacional
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

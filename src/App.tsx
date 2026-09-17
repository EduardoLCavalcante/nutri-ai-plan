import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { NutritionProvider } from "@/contexts/NutritionContext";
import Layout from "@/components/layout/Layout";
import PortfolioDisclaimer from "@/components/layout/PortfolioDisclaimer";
import ScrollToTop from "@/components/layout/ScrollToTop";
import Index from "./pages/Index";
import Formulario from "./pages/Formulario";
import Plano from "./pages/Plano";
import Chat from "./pages/Chat";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <NutritionProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <PortfolioDisclaimer />
          <BrowserRouter>
            <ScrollToTop />
            <Layout>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/formulario" element={<Formulario />} />
                <Route path="/plano" element={<Plano />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Layout>
          </BrowserRouter>
        </TooltipProvider>
      </NutritionProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;

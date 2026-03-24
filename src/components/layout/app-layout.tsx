
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sailboat } from "@/components/icons";
import {
  Sidebar,
  SidebarProvider,
  SidebarTrigger,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
} from "@/components/ui/sidebar";
import { Button } from "../ui/button";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Tableau de Bord" },
  { href: "/", icon: Sailboat, label: "Régates" },
  { href: "/runners", icon: Users, label: "Coureurs" },
];

function MobileBottomNav() {
  const pathname = usePathname();
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t p-2 flex justify-around md:hidden">
      {navItems.map((item) => (
        <Link 
          key={item.href} 
          href={item.href}
           className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-md w-24",
              // Special case for root to avoid matching all routes
              (pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))) && item.href !== "/" ? "text-primary bg-primary/10" :
              pathname === "/" && item.href === "/" ? "text-primary bg-primary/10" : "text-muted-foreground"
            )}>
            <item.icon className="h-6 w-6" />
            <span className="text-xs">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

function DesktopSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <Button variant="ghost" size="icon" asChild>
            <Link href="/">
              <Sailboat className="h-6 w-6" />
              <span className="sr-only">Accueil</span>
            </Link>
          </Button>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                 <SidebarMenuButton
                  asChild
                  isActive={(pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))) && item.href !== "/" ? true :
                  pathname === "/" && item.href === "/" ? true : false}
                  tooltip={{
                    children: item.label,
                  }}
                >
                  <Link href={item.href}>
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <SidebarTrigger />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}


export function AppLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const [isClient, setIsClient] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    setIsClient(true);
  }, []);
  
  if (!isClient) {
    return <div className="flex min-h-screen w-full flex-col bg-background">{children}</div>;
  }

  if (pathname?.startsWith("/obs")) {
    return <>{children}</>;
  }

  if (isMobile) {
    return (
      <div className="flex min-h-screen w-full flex-col bg-background">
        <main className="flex-1 pb-20">{children}</main>
        <MobileBottomNav />
      </div>
    );
  }

  return <DesktopSidebar>{children}</DesktopSidebar>;
}

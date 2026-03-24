
"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { LayoutDashboard } from "lucide-react";

export default function DashboardPage() {
  return (
    <main className="flex flex-1 flex-col p-4 md:p-6">
      <div className="flex items-center gap-4 mb-6">
        <LayoutDashboard className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold">Tableau de Bord</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Bienvenue</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Cette page servira de tableau de bord principal.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

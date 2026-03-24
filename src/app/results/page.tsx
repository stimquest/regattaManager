
"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Trophy } from "lucide-react";

export default function ResultsPage() {
  return (
    <main className="flex flex-1 flex-col p-4 md:p-6">
      <div className="flex items-center gap-4 mb-6">
        <Trophy className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold">Résultats</h1>
      </div>
       <Card>
        <CardHeader>
          <CardTitle>Résultats Globaux</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Cette page affichera les résultats de toutes les régates.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

"use client";

import { useState } from "react";
import { PaycheckForm } from "@/components/recommendations/paycheck-form";
import { AllocationChart } from "@/components/recommendations/allocation-chart";
import { AllocationTable } from "@/components/recommendations/allocation-table";
import { PaycheckInput, AllocationResult } from "@/types/recommendation";
import { Calculator, Lightbulb } from "lucide-react";

export default function RecommendationsPage() {
  const [result, setResult] = useState<AllocationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (input: PaycheckInput) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error("Failed to get recommendations:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Calculator className="h-6 w-6" />
          Paycheck Planner
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Get personalized recommendations for allocating your bimonthly paycheck across bills, debt payments, and savings
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-border bg-card p-5 sticky top-6">
            <h2 className="text-sm font-semibold text-foreground mb-4">
              Your Paycheck Details
            </h2>
            <PaycheckForm onSubmit={handleSubmit} isLoading={isLoading} />
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-6">
          {result ? (
            <>
              {/* Summary card */}
              <div className="rounded-xl border border-border bg-primary/5 p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Lightbulb className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">
                      Recommendation Summary
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {result.summary}
                    </p>
                  </div>
                </div>
              </div>

              <AllocationChart result={result} />
              <AllocationTable result={result} />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-96 text-center rounded-xl border border-dashed border-border bg-card">
              <Calculator className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Ready to Plan Your Paycheck
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Enter your paycheck details on the left to get a personalized
                allocation plan that prioritizes high-interest debt, meets
                minimum payments, and builds your savings.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

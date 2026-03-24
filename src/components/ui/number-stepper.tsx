
"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NumberStepperProps {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
}

export function NumberStepper({
  id,
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  disabled = false,
  className,
}: NumberStepperProps) {
  const handleStep = (direction: 'increment' | 'decrement') => {
    let newValue = value;
    if (direction === 'increment') {
      newValue = Math.min(max, value + step);
    } else {
      newValue = Math.max(min, value - step);
    }
    onChange(newValue);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        id={id ? `${id}-decrement` : undefined}
        variant="outline"
        size="icon"
        className="h-9 w-9"
        onClick={() => handleStep('decrement')}
        disabled={disabled || value <= min}
        type="button"
      >
        <Minus className="h-4 w-4" />
        <span className="sr-only">Decrement</span>
      </Button>
      <div className="w-16 text-center text-lg font-medium tabular-nums">
        {value}
      </div>
      <Button
        id={id ? `${id}-increment` : undefined}
        variant="outline"
        size="icon"
        className="h-9 w-9"
        onClick={() => handleStep('increment')}
        disabled={disabled || value >= max}
        type="button"
      >
        <Plus className="h-4 w-4" />
        <span className="sr-only">Increment</span>
      </Button>
    </div>
  );
}

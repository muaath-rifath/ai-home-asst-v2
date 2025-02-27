"use client";

import * as React from "react";
import { SunIcon } from "@radix-ui/react-icons";

interface Appliance {
  id: string;
  name: string;
  status: boolean;
}

export function ApplianceControl() {
  const [appliances, setAppliances] = React.useState<Appliance[]>([
    { id: "led1", name: "Living Room LED", status: false },
  ]);

  const toggleAppliance = (id: string) => {
    setAppliances((prev) =>
      prev.map((app) =>
        app.id === id ? { ...app, status: !app.status } : app
      )
    );
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="px-4 py-2 border-b">
        <h2 className="text-lg font-semibold">Appliance Control</h2>
      </div>
      <div className="px-4">
        {appliances.map((appliance) => (
          <button
            key={appliance.id}
            onClick={() => toggleAppliance(appliance.id)}
            className={`w-full flex items-center justify-between p-4 rounded-lg border mb-2 transition-colors ${
              appliance.status 
                ? "bg-primary text-primary-foreground" 
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            <div className="flex items-center gap-3">
              <SunIcon className="h-5 w-5" />
              <span>{appliance.name}</span>
            </div>
            <span className="text-sm">
              {appliance.status ? "ON" : "OFF"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
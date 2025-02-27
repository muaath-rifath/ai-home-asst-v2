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
    { id: "led2", name: "Kitchen LED", status: false },
    { id: "fan1", name: "Bedroom Fan", status: false },
    { id: "ac1", name: "Living Room AC", status: false },
  ]);

  const toggleAppliance = (id: string) => {
    setAppliances((prev) =>
      prev.map((app) =>
        app.id === id ? { ...app, status: !app.status } : app
      )
    );
  };

  return (
    <div className="flex flex-col min-h-full bg-background">
      <div className="flex-shrink-0 px-3 py-2 sm:px-4 sm:py-3 border-b">
        <h2 className="text-sm font-semibold sm:text-base lg:text-lg">Appliance Control</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Control your smart home devices</p>
      </div>
      <div className="flex-1 overflow-y-auto h-full p-2 sm:p-3 lg:p-4">
        <div className="grid grid-cols-1 gap-2">
          {appliances.map((appliance) => (
            <button
              key={appliance.id}
              onClick={() => toggleAppliance(appliance.id)}
              className={`flex items-center justify-between p-3 sm:p-4 rounded-lg border transition-colors ${
                appliance.status 
                  ? "bg-primary text-primary-foreground border-primary" 
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              <div className="flex items-center gap-3">
                <SunIcon className="h-5 w-5" />
                <span className="text-sm sm:text-base">{appliance.name}</span>
              </div>
              <span className="text-xs sm:text-sm font-medium bg-background/10 px-2 py-1 rounded-full">
                {appliance.status ? "ON" : "OFF"}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
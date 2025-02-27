"use client";

import * as React from "react";
import {
  LightningBoltIcon,
  StarIcon,
  SunIcon,
  TimerIcon,
} from "@radix-ui/react-icons";

const quickCommands = [
  { id: 1, command: "Turn off all lights", icon: <LightningBoltIcon /> },
  { id: 2, command: "Set night mode", icon: <StarIcon /> },
  { id: 3, command: "Check temperature", icon: <SunIcon /> },
  { id: 4, command: "Set timer for LED", icon: <TimerIcon /> },
];

const mockWeather = {
  temp: "28°C",
  condition: "Sunny",
  humidity: "65%",
};

const mockEnergy = {
  today: "5.2 kWh",
  thisMonth: "142 kWh",
  saving: "12%",
};

export function RightPanel() {
  return (
    <div className="flex flex-col min-h-full bg-background">
      <div className="flex-shrink-0 px-3 py-2 sm:px-4 sm:py-3 border-b">
        <h2 className="text-sm font-semibold sm:text-base lg:text-lg">Quick Access</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Commands & Information</p>
      </div>
      <div className="flex-1 overflow-y-auto h-full">
        <div className="p-2 sm:p-3 lg:p-4 space-y-4 sm:space-y-6">
          <section className="space-y-2 sm:space-y-3">
            <h3 className="text-sm font-medium px-1">Quick Commands</h3>
            <div className="grid grid-cols-1 gap-2">
              {quickCommands.map((cmd) => (
                <button
                  key={cmd.id}
                  className="flex items-center gap-3 w-full rounded-lg border bg-card p-3 text-sm hover:bg-muted transition-colors"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {cmd.icon}
                  </div>
                  <span>{cmd.command}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2 sm:space-y-3">
            <h3 className="text-sm font-medium px-1">Weather</h3>
            <div className="rounded-lg border bg-card p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <SunIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{mockWeather.temp}</p>
                    <p className="text-sm text-muted-foreground">
                      {mockWeather.condition}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Humidity</p>
                  <p className="text-lg font-medium">{mockWeather.humidity}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-2 sm:space-y-3">
            <h3 className="text-sm font-medium px-1">Energy Usage</h3>
            <div className="rounded-lg border bg-card p-3 sm:p-4 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted-foreground">Today</p>
                  <p className="text-lg font-medium">{mockEnergy.today}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">This Month</p>
                  <p className="text-lg font-medium">{mockEnergy.thisMonth}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-green-500">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/10">
                  <LightningBoltIcon className="h-4 w-4" />
                </div>
                <span>{mockEnergy.saving} less than last month</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
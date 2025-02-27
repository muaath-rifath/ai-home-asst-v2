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
    <div className="flex flex-col space-y-6 p-4">
      <section className="space-y-4">
        <h3 className="font-semibold">Quick Commands</h3>
        <div className="grid grid-cols-2 gap-2">
          {quickCommands.map((cmd) => (
            <button
              key={cmd.id}
              className="flex items-center gap-2 rounded-lg border bg-card p-3 text-sm hover:bg-muted"
            >
              {cmd.icon}
              <span>{cmd.command}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-semibold">Weather</h3>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SunIcon className="h-8 w-8" />
              <div>
                <p className="text-2xl font-bold">{mockWeather.temp}</p>
                <p className="text-sm text-muted-foreground">
                  {mockWeather.condition}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Humidity</p>
              <p className="font-medium">{mockWeather.humidity}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="font-semibold">Energy Usage</h3>
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">Today</p>
              <p className="font-medium">{mockEnergy.today}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">This Month</p>
              <p className="font-medium">{mockEnergy.thisMonth}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-green-500">
            <LightningBoltIcon />
            <span>{mockEnergy.saving} less than last month</span>
          </div>
        </div>
      </section>
    </div>
  );
}
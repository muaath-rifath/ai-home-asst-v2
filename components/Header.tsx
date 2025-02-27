"use client";

import * as React from "react";
import { ModeToggle } from "./mode-toggle";
import {
  DashboardIcon,
  GearIcon,
  HomeIcon,
  PersonIcon,
} from "@radix-ui/react-icons";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border bg-card">
              <HomeIcon className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">Sol</span>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                <span className="text-xs text-muted-foreground">Connected</span>
              </div>
            </div>
          </div>
        </div>
        <nav className="flex items-center gap-4 md:gap-6">
          <button className="inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
            <DashboardIcon className="h-5 w-5" />
            <span className="sr-only">Dashboard</span>
          </button>
          <button className="inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
            <PersonIcon className="h-5 w-5" />
            <span className="sr-only">Profile</span>
          </button>
          <button className="inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
            <GearIcon className="h-5 w-5" />
            <span className="sr-only">Settings</span>
          </button>
          <div className="h-4 w-[1px] bg-border" />
          <ModeToggle />
        </nav>
      </div>
    </header>
  );
}
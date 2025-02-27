"use client";

import React, { useState } from 'react';
import { useSwipeable } from 'react-swipeable';

interface SwipeableContainerProps {
  leftPanel: React.ReactNode;
  mainContent: React.ReactNode;
  rightPanel: React.ReactNode;
}

export function SwipeableContainer({ leftPanel, mainContent, rightPanel }: SwipeableContainerProps) {
  const [activePanel, setActivePanel] = useState<'left' | 'main' | 'right'>('main');

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      if (activePanel === 'left') setActivePanel('main');
      else if (activePanel === 'main') setActivePanel('right');
    },
    onSwipedRight: () => {
      if (activePanel === 'right') setActivePanel('main');
      else if (activePanel === 'main') setActivePanel('left');
    },
    trackMouse: true,
    preventScrollOnSwipe: true,
  });

  const translateClasses = {
    left: 'translate-x-[85%]',
    main: 'translate-x-0',
    right: '-translate-x-[85%]',
  };

  return (
    <div {...handlers} className="relative h-[calc(100vh-3.5rem)] overflow-hidden touch-pan-x">
      <div
        className={`flex h-full transition-transform duration-300 ease-in-out ${translateClasses[activePanel]}`}
      >
        {/* Left Panel */}
        <div className="min-w-[85%] h-full -ml-[85%]">
          {leftPanel}
        </div>

        {/* Main Content */}
        <div className="min-w-full h-full">
          {mainContent}
        </div>

        {/* Right Panel */}
        <div className="min-w-[85%] h-full">
          {rightPanel}
        </div>
      </div>

      {/* Navigation Dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 lg:hidden">
        <button
          onClick={() => setActivePanel('left')}
          className={`w-2 h-2 rounded-full transition-colors ${
            activePanel === 'left' ? 'bg-primary' : 'bg-muted'
          }`}
          aria-label="Show appliance controls"
          title="Show appliance controls"
        />
        <button
          onClick={() => setActivePanel('main')}
          className={`w-2 h-2 rounded-full transition-colors ${
            activePanel === 'main' ? 'bg-primary' : 'bg-muted'
          }`}
          aria-label="Show chat"
          title="Show chat"
        />
        <button
          onClick={() => setActivePanel('right')}
          className={`w-2 h-2 rounded-full transition-colors ${
            activePanel === 'right' ? 'bg-primary' : 'bg-muted'
          }`}
          aria-label="Show quick access"
          title="Show quick access"
        />
      </div>
    </div>
  );
}
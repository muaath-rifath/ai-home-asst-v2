"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useSwipeable } from 'react-swipeable';

interface SwipeableContainerProps {
  leftPanel: React.ReactNode;
  mainContent: React.ReactNode;
  rightPanel: React.ReactNode;
}

export function SwipeableContainer({ leftPanel, mainContent, rightPanel }: SwipeableContainerProps) {
  const [activePanel, setActivePanel] = useState<'left' | 'main' | 'right'>('main');
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollX, setScrollX] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

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
    delta: 10,
  });

  const translateClasses = {
    left: 'translate-x-[85%]',
    main: 'translate-x-0',
    right: '-translate-x-[85%]',
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setStartX(e.pageX - scrollX);
    if (contentRef.current) {
      contentRef.current.classList.add('dragging');
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !contentRef.current) return;

    const currentX = e.pageX - startX;
    const containerWidth = window.innerWidth;
    const maxScroll = containerWidth * 0.85;

    // Limit scrolling to the width of the side panels
    const clampedX = Math.max(Math.min(currentX, maxScroll), -maxScroll);
    setScrollX(clampedX);

    // Update active panel based on scroll position
    if (clampedX > maxScroll * 0.3) {
      setActivePanel('left');
    } else if (clampedX < -maxScroll * 0.3) {
      setActivePanel('right');
    } else {
      setActivePanel('main');
    }

    contentRef.current.style.setProperty('--swipe-x', `${clampedX}px`);
  };

  const handleMouseUp = () => {
    if (!isDragging || !contentRef.current) return;
    setIsDragging(false);
    setScrollX(0);
    contentRef.current.classList.remove('dragging');
    contentRef.current.style.removeProperty('--swipe-x');
  };

  // Clean up any lingering variables when component unmounts
  useEffect(() => {
    const currentContent = contentRef.current;
    return () => {
      if (currentContent) {
        currentContent.style.removeProperty('--swipe-x');
      }
    };
  }, []);

  return (
    <div 
      {...handlers} 
      className="fixed inset-0 top-14 overflow-hidden touch-pan-x select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        ref={contentRef}
        className={`swipeable-content flex h-full transition-transform duration-300 ease-in-out ${
          isDragging ? 'transition-none' : ''
        } ${translateClasses[activePanel]}`}
      >
        {/* Left Panel */}
        <div className="min-w-[85%] h-full -ml-[85%] hide-scrollbar">
          <div className="h-full overflow-y-auto">
            {leftPanel}
          </div>
        </div>

        {/* Main Content */}
        <div className="min-w-full h-full hide-scrollbar">
          <div className="h-full">
            {mainContent}
          </div>
        </div>

        {/* Right Panel */}
        <div className="min-w-[85%] h-full hide-scrollbar">
          <div className="h-full overflow-y-auto">
            {rightPanel}
          </div>
        </div>
      </div>
    </div>
  );
}
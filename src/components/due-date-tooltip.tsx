'use client';

import { useState, useEffect } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface DueDateTooltipProps {
  dueDate: string;
}

export function DueDateTooltip({ dueDate }: DueDateTooltipProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const dueDateObj = new Date(dueDate);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <span className={dueDateObj < new Date() ? 'text-destructive' : ''}>
            {format(dueDateObj, 'MMM d, yyyy')}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {isClient ? <p>{formatDistanceToNow(dueDateObj, { addSuffix: true })}</p> : <p>Loading...</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

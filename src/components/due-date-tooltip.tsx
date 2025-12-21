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

  if (!isClient) {
    return <span>Loading...</span>;
  }

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
          <p>{formatDistanceToNow(dueDateObj, { addSuffix: true })}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

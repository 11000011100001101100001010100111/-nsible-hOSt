
import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import LsOutput from '@/components/LsOutput';

const TerminalOutput = ({ events }) => {
  const endOfOutputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (endOfOutputRef.current) {
      endOfOutputRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events]);

  const renderEvent = (event, index) => {
    switch (event.type) {
      case 'command':
        return (
          <div key={index} className="flex items-center">
            <span className="themed-text-accent mr-2">@://</span>
            <p className="themed-text-primary">{event.message}</p>
          </div>
        );
      case 'info':
        return (
          <div key={index} className="my-1">
            <p className="font-bold themed-text-primary">{event.title}</p>
            <pre className="whitespace-pre-wrap themed-text-secondary">{event.message}</pre>
          </div>
        );
      case 'success':
        return (
          <div key={index} className="my-1 text-green-400">
            <p className="font-bold">{event.title}</p>
            <p>{event.message}</p>
          </div>
        );
      case 'error':
        return (
          <div key={index} className="my-1 text-red-500">
            <p className="font-bold">{event.title}</p>
            <p>{event.message}</p>
          </div>
        );
      case 'message':
         return (
          <div key={index} className="my-1 p-2 rounded bg-blue-900/30">
            <p className="font-bold text-blue-300">{event.title}</p>
            <p className="text-blue-200">{event.message}</p>
          </div>
        );
      case 'ls':
        return <LsOutput key={index} items={event.items} path={event.path} />;
       case 'audio':
        return <div key={index}>{event.component}</div>;
      default:
        return <p key={index} className="themed-text-secondary">{JSON.stringify(event)}</p>;
    }
  };

  return (
    <div ref={containerRef} className="h-full flex-grow overflow-y-auto p-2 font-mono text-sm border themed-border-accent">
      <div className="flex flex-col space-y-2">
        {events.map(renderEvent)}
        <div ref={endOfOutputRef} />
      </div>
    </div>
  );
};

export default TerminalOutput;

import React from 'react';

export declare function aiAvailability(): { available: boolean; reason: string; backend: string };
export declare function askAi(prompt: string, instructions?: string): Promise<string | null>;

export default function AiAssist(props: {
  app?: string;
  hint?: string;
  gutter?: number;
}): React.ReactElement;

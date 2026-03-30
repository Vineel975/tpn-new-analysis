"use client";

import { Toggle } from "@/components/ui/toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ProcessingState } from "@/src/processing-service";

interface ProcessingLogsProps {
  isProcessing: boolean;
  state?: ProcessingState;
  showLogs: boolean;
  onToggleLogs: (value: boolean) => void;
  logs: Array<{ id: string; message: string }>;
}

export function ProcessingLogs({
  isProcessing,
  state,
  showLogs,
  onToggleLogs,
  logs,
}: ProcessingLogsProps) {
  return (
    <Card className="flex-1 overflow-y-auto">
      <CardHeader className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Processing logs</CardTitle>
            <CardDescription>
              Live updates while we analyze your hospital bill.
            </CardDescription>
          </div>
          <Toggle
            pressed={showLogs}
            onPressedChange={onToggleLogs}
            aria-label="Toggle processing logs"
            className="data-[state=on]:bg-[#1E3A8A] data-[state=on]:text-white"
          >
            {showLogs ? "Hide logs" : "Show logs"}
          </Toggle>
        </div>
        <div className="text-sm text-muted-foreground">
          Status: {state?.status ?? (isProcessing ? "processing" : "idle")} •{" "}
          {state?.completed ?? 0}/{state?.total ?? 0} tasks completed
        </div>
      </CardHeader>
      {showLogs ? (
        <CardContent className="pb-6">
          <div className="bg-gray-900 text-gray-100 font-mono text-sm rounded-md border border-gray-800 p-4 h-72 overflow-y-auto space-y-3">
            {logs.length === 0 ? (
              <p className="text-gray-400">Waiting for updates...</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="text-gray-50">
                  {log.message}
                </div>
              ))
            )}
          </div>
        </CardContent>
      ) : (
        <CardContent className="pb-6">
          <p className="text-sm text-muted-foreground">
            Logs are hidden. Toggle to view live updates.
          </p>
        </CardContent>
      )}
    </Card>
  );
}

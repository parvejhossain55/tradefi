import { Card, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { ExecutionHistoryTable } from '@/components/executions/ExecutionHistoryTable';
import { useTradingStore } from '@/store/tradingStore';

export function ExecutionHistory() {
  const snapshot = useTradingStore((state) => state.snapshot);
  if (!snapshot) return null;

  const executions = snapshot.executions;
  const latencies = executions
    .map((execution) => execution.latencyMs)
    .filter((latency): latency is number => latency !== undefined);
  const averageLatency =
    latencies.length > 0
      ? Math.round(latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length)
      : null;

  return (
    <div>
      <PageHeader
        title="Execution History"
        description="Simulated processing records prepared for a future backend contract. No orders were placed, no broker was contacted, and no profit or loss exists."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Execution records"
          value={executions.length}
          hint="All simulation mode"
          icon="executions"
          tone="primary"
        />
        <StatCard
          label="Successful"
          value={executions.filter((execution) => execution.status === 'success').length}
          hint="Simulated processing only"
          icon="checkCircle"
          tone="success"
        />
        <StatCard
          label="Failed / skipped"
          value={
            executions.filter(
              (execution) => execution.status === 'failed' || execution.status === 'skipped'
            ).length
          }
          hint="Includes blocked risk checks"
          icon="alertTriangle"
          tone="warning"
        />
        <StatCard
          label="Avg demo latency"
          value={averageLatency === null ? '—' : `${averageLatency} ms`}
          hint="Mock processing timings"
          icon="clock"
          tone="neutral"
        />
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Execution records"
          description="Mode is always Simulation. Open a row to inspect latency or error details."
        />
        <ExecutionHistoryTable
          executions={executions}
          pairs={snapshot.pairs}
          strategies={snapshot.strategies}
          showPairFilter
          pageSize={10}
        />
      </Card>
    </div>
  );
}

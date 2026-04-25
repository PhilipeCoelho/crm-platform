/**
 * Performance Monitor — Vamus Pipeline CRM
 * Measures action→visual-update latency for critical user actions.
 * 
 * Usage:
 *   perfMonitor.start('action-name');
 *   // ... action happens ...
 *   perfMonitor.end('action-name');
 *   perfMonitor.report(); // prints summary
 */

interface PerfEntry {
    label: string;
    startTime: number;
    endTime?: number;
    duration?: number;
}

interface PerfSummary {
    label: string;
    count: number;
    min: number;
    max: number;
    avg: number;
    entries: number[];
}

class PerformanceMonitor {
    private entries: Map<string, PerfEntry[]> = new Map();
    private active: Map<string, number> = new Map();
    private renderCounts: Map<string, number> = new Map();

    start(label: string) {
        this.active.set(label, performance.now());
    }

    end(label: string) {
        const startTime = this.active.get(label);
        if (!startTime) return;

        const endTime = performance.now();
        const duration = endTime - startTime;

        if (!this.entries.has(label)) {
            this.entries.set(label, []);
        }
        this.entries.get(label)!.push({ label, startTime, endTime, duration });
        this.active.delete(label);

        console.log(`⚡ [PERF] ${label}: ${duration.toFixed(1)}ms`);
        return duration;
    }

    trackRender(componentName: string) {
        const count = (this.renderCounts.get(componentName) || 0) + 1;
        this.renderCounts.set(componentName, count);
    }

    resetRenderCounts() {
        this.renderCounts.clear();
    }

    getRenderReport(): Record<string, number> {
        const result: Record<string, number> = {};
        this.renderCounts.forEach((count, name) => {
            result[name] = count;
        });
        return result;
    }

    getSummary(label: string): PerfSummary | null {
        const items = this.entries.get(label);
        if (!items || items.length === 0) return null;

        const durations = items.map(e => e.duration!).filter(d => d !== undefined);
        return {
            label,
            count: durations.length,
            min: Math.min(...durations),
            max: Math.max(...durations),
            avg: durations.reduce((a, b) => a + b, 0) / durations.length,
            entries: durations,
        };
    }

    report() {
        console.log('\n📊 ═══════════════════════════════════════════');
        console.log('   PERFORMANCE REPORT — Vamus Pipeline CRM');
        console.log('═══════════════════════════════════════════\n');

        this.entries.forEach((_, label) => {
            const summary = this.getSummary(label);
            if (summary) {
                console.log(`🔹 ${summary.label}`);
                console.log(`   Executions: ${summary.count}`);
                console.log(`   Min: ${summary.min.toFixed(1)}ms`);
                console.log(`   Max: ${summary.max.toFixed(1)}ms`);
                console.log(`   Avg: ${summary.avg.toFixed(1)}ms`);
                console.log(`   All: [${summary.entries.map(d => d.toFixed(1)).join(', ')}]ms`);
                console.log('');
            }
        });

        const renderReport = this.getRenderReport();
        if (Object.keys(renderReport).length > 0) {
            console.log('🔸 Render Counts:');
            Object.entries(renderReport)
                .sort((a, b) => b[1] - a[1])
                .forEach(([name, count]) => {
                    console.log(`   ${name}: ${count}x`);
                });
            console.log('');
        }

        console.log('═══════════════════════════════════════════\n');
    }

    clear() {
        this.entries.clear();
        this.active.clear();
        this.renderCounts.clear();
    }
}

export const perfMonitor = new PerformanceMonitor();

// Make it available globally for browser console access
if (typeof window !== 'undefined') {
    (window as any).__perf = perfMonitor;
}

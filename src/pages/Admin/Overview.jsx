import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Users, FileText, CreditCard, ShieldAlert, TrendingUp, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

function StatCard({ icon: Icon, label, value, color, loading }) {
  return (
    <div className="bg-white rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
      {loading ? <Skeleton className="h-8 w-24" /> : (
        <p className="text-3xl font-bold font-jakarta text-foreground">{value}</p>
      )}
    </div>
  );
}

export default function AdminOverview() {
  const { data: users = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => base44.entities.UserProfile.list(),
  });
  const { data: reports = [], isLoading: loadingReports } = useQuery({
    queryKey: ['admin-reports'],
    queryFn: () => base44.entities.ModerationReport.list(),
  });
  const { data: payouts = [], isLoading: loadingPayouts } = useQuery({
    queryKey: ['admin-payouts'],
    queryFn: () => base44.entities.PayoutRequest.list(),
  });
  const { data: alerts = [], isLoading: loadingAlerts } = useQuery({
    queryKey: ['admin-alerts'],
    queryFn: () => base44.entities.PlatformAlert.list(),
  });

  const openReports = reports.filter(r => r.status === 'open').length;
  const pendingPayouts = payouts.filter(p => p.status === 'pending').length;
  const openAlerts = alerts.filter(a => a.status === 'open').length;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold font-jakarta text-foreground">Platform Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">Real-time platform health and metrics</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Users}       label="Total Users"       value={users.length}    color="bg-primary"     loading={loadingUsers} />
        <StatCard icon={ShieldAlert} label="Open Reports"      value={openReports}     color="bg-destructive" loading={loadingReports} />
        <StatCard icon={CreditCard}  label="Pending Payouts"   value={pendingPayouts}  color="bg-amber-500"   loading={loadingPayouts} />
        <StatCard icon={AlertTriangle} label="Active Alerts"   value={openAlerts}      color="bg-orange-500"  loading={loadingAlerts} />
      </div>

      {/* Recent Alerts */}
      <div className="bg-white rounded-2xl border border-border p-6">
        <h2 className="font-semibold text-base font-jakarta mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-500" /> Recent Platform Alerts
        </h2>
        {loadingAlerts ? (
          <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No alerts — platform is healthy ✓</p>
        ) : (
          <div className="space-y-2">
            {alerts.slice(0, 5).map(alert => (
              <div key={alert.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/40">
                <div>
                  <p className="text-sm font-medium text-foreground">{alert.title}</p>
                  <p className="text-xs text-muted-foreground">{alert.alert_type}</p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  alert.severity === 'critical' ? 'bg-destructive/10 text-destructive' :
                  alert.severity === 'warning'  ? 'bg-amber-100 text-amber-700' :
                  'bg-secondary text-secondary-foreground'
                }`}>{alert.severity}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
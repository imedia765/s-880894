import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { Settings, User, Shield, Database, Route, Key, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface UserRoleCardProps {
  userId: string;
  userName: string;
}

const UserRoleCard = ({ userId, userName }: UserRoleCardProps) => {
  const [showDiagnosis, setShowDiagnosis] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const { toast } = useToast();

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toISOString()}] ${message}`]);
  };

  const { data: userDiagnostics, isLoading } = useQuery({
    queryKey: ['userDiagnostics', userId, showDiagnosis],
    queryFn: async () => {
      if (!showDiagnosis) return null;
      
      addLog('Starting user diagnostics...');
      
      // Fetch user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId);

      if (rolesError) {
        addLog(`Error fetching roles: ${rolesError.message}`);
        throw rolesError;
      }
      addLog(`Found ${roles?.length || 0} roles`);

      // Fetch member profile
      const { data: member, error: memberError } = await supabase
        .from('members')
        .select('*')
        .eq('auth_user_id', userId)
        .single();

      if (memberError && memberError.code !== 'PGRST116') {
        addLog(`Error fetching member: ${memberError.message}`);
        throw memberError;
      }
      addLog(member ? 'Found member profile' : 'No member profile found');

      // Fetch collector info if exists
      const { data: collector, error: collectorError } = await supabase
        .from('members_collectors')
        .select('*')
        .eq('member_number', member?.member_number);

      if (collectorError) {
        addLog(`Error fetching collector info: ${collectorError.message}`);
        throw collectorError;
      }
      addLog(`Found ${collector?.length || 0} collector records`);

      // Fetch audit logs
      const { data: auditLogs, error: auditError } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(10);

      if (auditError) {
        addLog(`Error fetching audit logs: ${auditError.message}`);
        throw auditError;
      }
      addLog(`Found ${auditLogs?.length || 0} audit logs`);

      // Fetch payment records
      const { data: payments, error: paymentsError } = await supabase
        .from('payment_requests')
        .select('*')
        .eq('member_number', member?.member_number)
        .order('created_at', { ascending: false })
        .limit(10);

      if (paymentsError) {
        addLog(`Error fetching payments: ${paymentsError.message}`);
        throw paymentsError;
      }
      addLog(`Found ${payments?.length || 0} payment records`);

      const diagnosticResult = {
        roles: roles || [],
        member: member || null,
        collector: collector || [],
        auditLogs: auditLogs || [],
        payments: payments || [],
        accessibleTables: [
          'members',
          'user_roles',
          'payment_requests',
          'members_collectors',
          'audit_logs'
        ],
        permissions: {
          canManageRoles: roles?.some(r => r.role === 'admin') || false,
          canCollectPayments: (collector?.length || 0) > 0,
          canAccessAuditLogs: roles?.some(r => r.role === 'admin') || false,
          canManageMembers: roles?.some(r => ['admin', 'collector'].includes(r.role)) || false
        },
        routes: {
          dashboard: true,
          profile: true,
          payments: true,
          settings: roles?.some(r => r.role === 'admin') || false,
          system: roles?.some(r => r.role === 'admin') || false,
          audit: roles?.some(r => r.role === 'admin') || false
        },
        timestamp: new Date().toISOString()
      };

      return diagnosticResult;
    },
    enabled: showDiagnosis
  });

  return (
    <Card className="p-4 bg-dashboard-card border-dashboard-cardBorder">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-dashboard-accent1" />
          <h3 className="text-lg font-medium text-white">{userName}</h3>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <Settings className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[600px] bg-dashboard-card border-dashboard-cardBorder">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-medium text-white">User Diagnostics</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowDiagnosis(true);
                    setLogs([]);
                  }}
                  disabled={isLoading}
                >
                  {isLoading ? 'Running...' : 'Run Diagnostics'}
                </Button>
              </div>

              {userDiagnostics && (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {/* Roles Section */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="w-4 h-4 text-dashboard-accent1" />
                        <h5 className="font-medium text-white">Assigned Roles</h5>
                      </div>
                      <div className="bg-dashboard-cardHover rounded-lg p-3">
                        <div className="flex gap-2 flex-wrap">
                          {userDiagnostics.roles.map((role) => (
                            <Badge key={role.id} variant="default">
                              {role.role}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Routes Section */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Route className="w-4 h-4 text-dashboard-accent1" />
                        <h5 className="font-medium text-white">Accessible Routes</h5>
                      </div>
                      <div className="bg-dashboard-cardHover rounded-lg p-3">
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(userDiagnostics.routes || {}).map(([route, hasAccess]) => (
                            <div key={route} className="flex items-center gap-2">
                              <Badge variant={hasAccess ? "default" : "secondary"}>
                                {route}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Database Access Section */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Database className="w-4 h-4 text-dashboard-accent1" />
                        <h5 className="font-medium text-white">Database Access</h5>
                      </div>
                      <div className="bg-dashboard-cardHover rounded-lg p-3">
                        <div className="grid grid-cols-2 gap-2">
                          {userDiagnostics.accessibleTables.map((table) => (
                            <Badge key={table} variant="outline">
                              {table}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Permissions Section */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Key className="w-4 h-4 text-dashboard-accent1" />
                        <h5 className="font-medium text-white">Permissions</h5>
                      </div>
                      <div className="bg-dashboard-cardHover rounded-lg p-3">
                        <div className="space-y-2">
                          {Object.entries(userDiagnostics.permissions || {}).map(([perm, granted]) => (
                            <div key={perm} className="flex items-center justify-between">
                              <span className="text-sm text-dashboard-text">
                                {perm.replace(/([A-Z])/g, ' $1').trim()}
                              </span>
                              <Badge variant={granted ? "default" : "secondary"}>
                                {granted ? 'Granted' : 'Denied'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Debug Console */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-dashboard-accent1" />
                        <h5 className="font-medium text-white">Debug Console</h5>
                      </div>
                      <div className="bg-black/50 rounded-lg p-3 font-mono text-xs">
                        <ScrollArea className="h-[200px]">
                          {logs.map((log, index) => (
                            <div key={index} className="text-dashboard-text">
                              {log}
                            </div>
                          ))}
                        </ScrollArea>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
};

export default UserRoleCard;
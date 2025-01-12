import { Card } from "@/components/ui/card";
import { Database } from "@/integrations/supabase/types";
import { Shield, User, Settings, Database as DatabaseIcon, Key, Route, Table, Lock } from "lucide-react";
import RoleSelect from "./RoleSelect";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DebugConsole } from "@/components/logs/DebugConsole";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

type UserRole = Database['public']['Enums']['app_role'];

interface UserData {
  id: string;
  user_id: string;
  full_name: string;
  member_number: string;
  role: UserRole;
  auth_user_id: string;
  user_roles: { role: UserRole }[];
}

interface UserRoleCardProps {
  user: UserData;
  onRoleChange: (userId: string, newRole: UserRole) => void;
}

const UserRoleCard = ({ user, onRoleChange }: UserRoleCardProps) => {
  const [showDiagnosis, setShowDiagnosis] = useState(false);
  const [diagnosticLogs, setDiagnosticLogs] = useState<string[]>([]);

  const { data: userDiagnostics, isLoading } = useQuery({
    queryKey: ['userDiagnostics', user.auth_user_id],
    queryFn: async () => {
      const addLog = (message: string) => {
        setDiagnosticLogs(prev => [...prev, message]);
      };

      addLog(`Starting comprehensive diagnosis for user ${user.full_name}`);

      // Check user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.auth_user_id);

      if (rolesError) {
        addLog(`Error fetching roles: ${rolesError.message}`);
        return null;
      }

      addLog(`Found ${roles?.length || 0} role assignments`);

      // Check member profile
      const { data: member, error: memberError } = await supabase
        .from('members')
        .select('*')
        .eq('auth_user_id', user.auth_user_id)
        .single();

      if (memberError) {
        addLog(`Error fetching member profile: ${memberError.message}`);
      } else {
        addLog(`Member profile found: ${member.member_number}`);
      }

      // Check collector status
      const { data: collector, error: collectorError } = await supabase
        .from('members_collectors')
        .select('*')
        .eq('member_number', member?.member_number);

      if (collectorError) {
        addLog(`Error fetching collector info: ${collectorError.message}`);
      } else if (collector && collector.length > 0) {
        addLog(`User is a collector: ${collector[0].name}`);
      }

      // Check audit logs
      const { data: auditLogs, error: auditError } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('user_id', user.auth_user_id)
        .order('timestamp', { ascending: false })
        .limit(5);

      if (auditError) {
        addLog(`Error fetching audit logs: ${auditError.message}`);
      } else {
        addLog(`Found ${auditLogs?.length || 0} recent audit logs`);
      }

      // Check payment requests
      const { data: payments, error: paymentsError } = await supabase
        .from('payment_requests')
        .select('*')
        .eq('member_number', member?.member_number);

      if (paymentsError) {
        addLog(`Error fetching payment history: ${paymentsError.message}`);
      } else {
        addLog(`Found ${payments?.length || 0} payment records`);
      }

      return {
        roles,
        member,
        collector,
        auditLogs,
        payments,
        accessibleTables: [
          'members',
          'user_roles',
          'payment_requests',
          'family_members',
          'audit_logs'
        ],
        permissions: {
          canManageRoles: roles?.some(r => r.role === 'admin'),
          canCollectPayments: collector?.length > 0,
          canAccessAuditLogs: roles?.some(r => r.role === 'admin'),
          canManageMembers: roles?.some(r => ['admin', 'collector'].includes(r.role))
        },
        routes: {
          dashboard: true,
          profile: true,
          payments: true,
          settings: roles?.some(r => r.role === 'admin'),
          system: roles?.some(r => r.role === 'admin'),
          audit: roles?.some(r => r.role === 'admin')
        },
        timestamp: new Date().toISOString()
      };
    },
    enabled: showDiagnosis
  });

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'text-dashboard-accent1';
      case 'collector':
        return 'text-dashboard-accent2';
      default:
        return 'text-dashboard-accent3';
    }
  };

  return (
    <Card className="p-4 bg-dashboard-card border-white/10 hover:border-white/20 transition-all duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-full bg-dashboard-accent1/10">
            <User className="w-5 h-5 text-dashboard-accent1" />
          </div>
          <div>
            <h3 className="font-medium text-white">{user.full_name}</h3>
            <p className="text-sm text-dashboard-muted">#{user.member_number}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Shield className={`w-4 h-4 ${getRoleColor(user.role)}`} />
            <RoleSelect
              userId={user.auth_user_id}
              currentRole={user.role}
              onRoleChange={(newRole) => onRoleChange(user.auth_user_id, newRole)}
            />
          </div>
          
          <DropdownMenu open={showDiagnosis} onOpenChange={setShowDiagnosis}>
            <DropdownMenuTrigger>
              <div className="p-2 rounded-full bg-dashboard-accent2/10 cursor-pointer hover:bg-dashboard-accent2/20 transition-colors">
                <Settings className="w-4 h-4 text-dashboard-accent2" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[600px] bg-dashboard-card border-dashboard-cardBorder p-6">
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-medium text-dashboard-accent1">User Diagnostics</h4>
                    <Badge variant="outline" className="text-dashboard-accent2">
                      {isLoading ? 'Running...' : 'Complete'}
                    </Badge>
                  </div>
                  
                  {userDiagnostics && (
                    <div className="space-y-4">
                      {/* Roles Section */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Key className="w-4 h-4 text-dashboard-accent1" />
                          <h5 className="text-sm font-medium text-dashboard-accent1">Assigned Roles</h5>
                        </div>
                        <div className="bg-dashboard-cardHover rounded-lg p-3">
                          <div className="grid grid-cols-2 gap-2">
                            {userDiagnostics.roles?.map((role, idx) => (
                              <Badge key={idx} variant="outline" className={getRoleColor(role.role)}>
                                {role.role}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Routes Section */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Route className="w-4 h-4 text-dashboard-accent1" />
                          <h5 className="text-sm font-medium text-dashboard-accent1">Accessible Routes</h5>
                        </div>
                        <div className="bg-dashboard-cardHover rounded-lg p-3">
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(userDiagnostics.routes).map(([route, hasAccess]) => (
                              <div key={route} className="flex items-center gap-2">
                                <Badge variant={hasAccess ? "default" : "secondary"}>
                                  {route}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Database Tables Section */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Table className="w-4 h-4 text-dashboard-accent1" />
                          <h5 className="text-sm font-medium text-dashboard-accent1">Database Access</h5>
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
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4 text-dashboard-accent1" />
                          <h5 className="text-sm font-medium text-dashboard-accent1">Permissions</h5>
                        </div>
                        <div className="bg-dashboard-cardHover rounded-lg p-3">
                          <div className="space-y-2">
                            {Object.entries(userDiagnostics.permissions).map(([perm, granted]) => (
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

                      <Separator className="my-4" />

                      <DebugConsole logs={diagnosticLogs} />
                    </div>
                  )}
                </div>
              </ScrollArea>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
};

export default UserRoleCard;
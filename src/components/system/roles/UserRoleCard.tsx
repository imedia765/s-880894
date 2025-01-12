import { Card } from "@/components/ui/card";
import { Database } from "@/integrations/supabase/types";
import { Shield, User, Settings } from "lucide-react";
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

  const { data: userDiagnostics } = useQuery({
    queryKey: ['userDiagnostics', user.auth_user_id],
    queryFn: async () => {
      const addLog = (message: string) => {
        setDiagnosticLogs(prev => [...prev, message]);
      };

      addLog(`Starting diagnosis for user ${user.full_name}`);

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

      return {
        roles,
        member,
        collector,
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
            <DropdownMenuContent className="w-[400px] bg-dashboard-card border-dashboard-border p-4">
              <div className="space-y-4">
                <h4 className="text-lg font-medium text-dashboard-text">User Diagnostics</h4>
                
                {userDiagnostics && (
                  <div className="space-y-2">
                    <div className="bg-dashboard-card/50 p-3 rounded-lg">
                      <h5 className="text-sm font-medium text-dashboard-accent1 mb-2">Role Assignments</h5>
                      <div className="space-y-1">
                        {userDiagnostics.roles?.map((role, idx) => (
                          <div key={idx} className="text-sm text-dashboard-text">
                            {role.role} (assigned: {new Date(role.created_at).toLocaleDateString()})
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-dashboard-card/50 p-3 rounded-lg">
                      <h5 className="text-sm font-medium text-dashboard-accent1 mb-2">Member Profile</h5>
                      {userDiagnostics.member ? (
                        <div className="text-sm text-dashboard-text">
                          <div>Status: {userDiagnostics.member.status}</div>
                          <div>Verified: {userDiagnostics.member.verified ? 'Yes' : 'No'}</div>
                          <div>Created: {new Date(userDiagnostics.member.created_at).toLocaleDateString()}</div>
                        </div>
                      ) : (
                        <div className="text-sm text-dashboard-muted">No member profile found</div>
                      )}
                    </div>

                    {userDiagnostics.collector && userDiagnostics.collector.length > 0 && (
                      <div className="bg-dashboard-card/50 p-3 rounded-lg">
                        <h5 className="text-sm font-medium text-dashboard-accent1 mb-2">Collector Status</h5>
                        <div className="text-sm text-dashboard-text">
                          <div>Name: {userDiagnostics.collector[0].name}</div>
                          <div>Active: {userDiagnostics.collector[0].active ? 'Yes' : 'No'}</div>
                          <div>Created: {new Date(userDiagnostics.collector[0].created_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <DebugConsole logs={diagnosticLogs} />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
};

export default UserRoleCard;
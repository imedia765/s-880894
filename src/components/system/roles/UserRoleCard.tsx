import { Card } from "@/components/ui/card";
import { Database } from "@/integrations/supabase/types";
import { Shield, User, Settings } from "lucide-react";
import RoleSelect from "./RoleSelect";

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
          
          <div className="p-2 rounded-full bg-dashboard-accent2/10 cursor-pointer hover:bg-dashboard-accent2/20 transition-colors">
            <Settings className="w-4 h-4 text-dashboard-accent2" />
          </div>
        </div>
      </div>
    </Card>
  );
};

export default UserRoleCard;
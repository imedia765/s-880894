import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DatabaseEnums } from "@/integrations/supabase/types/enums";
import { Settings } from "lucide-react";
import RolesSection from "./RolesSection";
import RoutesSection from "./RoutesSection";
import DatabaseAccessSection from "./DatabaseAccessSection";
import PermissionsSection from "./PermissionsSection";
import DebugConsole from "./DebugConsole";

type UserRole = DatabaseEnums['app_role'];

interface DiagnosticResult {
  roles: Array<{ role: UserRole }>;
  member: any | null;
  collector: any[];
  auditLogs: any[];
  payments: any[];
  accessibleTables: string[];
  permissions: {
    canManageRoles: boolean;
    canCollectPayments: boolean;
    canAccessAuditLogs: boolean;
    canManageMembers: boolean;
  };
  routes: {
    [key: string]: boolean;
  };
  timestamp: string;
}

interface DiagnosticsPanelProps {
  isLoading: boolean;
  userDiagnostics: DiagnosticResult | null;
  logs: string[];
  onRunDiagnostics: () => void;
}

const DiagnosticsPanel = ({ isLoading, userDiagnostics, logs, onRunDiagnostics }: DiagnosticsPanelProps) => {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-medium text-white">User Diagnostics</h4>
        <Button
          variant="outline"
          size="sm"
          onClick={onRunDiagnostics}
          disabled={isLoading}
        >
          {isLoading ? 'Running...' : 'Run Diagnostics'}
        </Button>
      </div>

      {userDiagnostics && (
        <ScrollArea className="h-[400px]">
          <div className="space-y-4">
            <RolesSection roles={userDiagnostics.roles} />
            <RoutesSection routes={userDiagnostics.routes} />
            <DatabaseAccessSection tables={userDiagnostics.accessibleTables} />
            <PermissionsSection permissions={userDiagnostics.permissions} />
            <DebugConsole logs={logs} />
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default DiagnosticsPanel;
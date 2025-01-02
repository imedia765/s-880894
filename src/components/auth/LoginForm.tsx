import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const LoginForm = () => {
  const [memberNumber, setMemberNumber] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    console.log("Starting login process with member number:", memberNumber);

    try {
      // First clear any existing sessions
      await supabase.auth.signOut();
      
      // First verify member credentials using RPC
      const { data: memberData, error: rpcError } = await supabase.rpc('authenticate_member', {
        p_member_number: memberNumber,
        p_password: password
      });

      if (rpcError) {
        console.error("RPC Error:", rpcError);
        throw new Error('Invalid credentials');
      }

      if (!memberData || memberData.length === 0) {
        console.error("No member data returned");
        throw new Error('Invalid credentials');
      }

      console.log("Member authenticated:", memberData);

      // Sign in with credentials
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: `${memberNumber}@pwa.org`,
        password: memberNumber, // Using member number as initial password
      });

      if (signInError) {
        console.error("Sign in error:", signInError);
        
        // If sign in fails, try to create the account
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: `${memberNumber}@pwa.org`,
          password: memberNumber,
          options: {
            data: {
              member_number: memberNumber,
              full_name: memberData[0].full_name,
              email: memberData[0].email,
            }
          }
        });

        if (signUpError) {
          console.error("Sign up error:", signUpError);
          throw new Error('Failed to create account');
        }

        console.log("New account created:", signUpData);
      } else {
        console.log("Sign in successful:", signInData);
      }

      toast({
        title: "Success",
        description: "Logged in successfully",
      });
      
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to login",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="space-y-4 w-full max-w-sm">
      <div className="space-y-2">
        <Label htmlFor="memberNumber">Member Number</Label>
        <Input
          id="memberNumber"
          type="text"
          value={memberNumber}
          onChange={(e) => setMemberNumber(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Logging in..." : "Login"}
      </Button>
    </form>
  );
};
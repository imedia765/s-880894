import { supabase } from "@/integrations/supabase/client";

export const updateProfileAndEmail = async (
  formData: FormData,
  newPassword: string,
  oldEmail: string
) => {
  console.log("Starting profile and email update process");

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user?.email) {
    throw new Error("User session expired");
  }

  // Get current member data to compare password
  const { data: currentMember, error: memberError } = await supabase
    .from('members')
    .select('*')
    .eq('email', oldEmail)
    .single();

  if (memberError) {
    console.error("Error fetching current member:", memberError);
    throw new Error("Failed to verify current member data");
  }

  try {
    // First update auth user password if provided
    if (newPassword) {
      console.log("Updating password...");
      
      try {
        const { error: pwError } = await supabase.auth.updateUser({
          password: newPassword
        });

        if (pwError) {
          // Handle the same password error specifically
          if (pwError.message.includes("same_password")) {
            throw new Error("New password must be different from your current password");
          }
          throw pwError;
        }
      } catch (error) {
        console.error("Password update error:", error);
        throw error;
      }
    }

    // Get the new email from form data
    const newEmail = String(formData.get('email') || '');
    
    // Only update email if it's different and not a temporary email
    if (newEmail !== oldEmail && !oldEmail.includes('@temp.pwaburton.org')) {
      console.log("Updating email from", oldEmail, "to", newEmail);
      const { error: emailError } = await supabase.auth.updateUser({
        email: newEmail,
      });

      if (emailError) {
        console.error("Email update error:", emailError);
        throw emailError;
      }
    }

    // Update all member profile data
    const updatedData = {
      full_name: String(formData.get('fullName') || ''),
      email: newEmail,
      phone: String(formData.get('phone') || ''),
      address: String(formData.get('address') || ''),
      town: String(formData.get('town') || ''),
      postcode: String(formData.get('postcode') || ''),
      date_of_birth: String(formData.get('dob') || ''),
      gender: String(formData.get('gender') || ''),
      marital_status: String(formData.get('maritalStatus') || ''),
      updated_at: new Date().toISOString(),
      password_changed: newPassword ? true : currentMember.password_changed,
      profile_updated: true,
      first_time_login: false,
      profile_completed: true,
      email_verified: newEmail !== oldEmail ? false : currentMember.email_verified,
      default_password_hash: newPassword || currentMember.default_password_hash
    };

    console.log("Updating member profile with data:", updatedData);

    // Update member record
    const { error: updateError } = await supabase
      .from('members')
      .update(updatedData)
      .eq('email', oldEmail);

    if (updateError) {
      console.error("Profile update error:", updateError);
      throw updateError;
    }

    console.log("Profile update completed successfully");
    return { success: true };
  } catch (error) {
    console.error("Update error:", error);
    throw error;
  }
};
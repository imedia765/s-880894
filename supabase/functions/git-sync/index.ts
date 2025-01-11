import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function validateGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname !== 'github.com') {
      throw new Error('Invalid GitHub URL');
    }
    
    const match = url.match(/github\.com\/([^\/]+)\/([^\.]+)(?:\.git)?$/);
    if (!match) {
      throw new Error('Invalid repository URL format');
    }
    
    return {
      owner: match[1],
      repo: match[2]
    };
  } catch (error) {
    console.error('URL validation error:', error);
    return null;
  }
}

async function getGitHubReference(owner: string, repo: string, ref: string, token: string) {
  console.log(`Getting reference for ${owner}/${repo}#${ref}`);
  
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${ref}`,
      {
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`Reference ${ref} not found in ${owner}/${repo}`);
        return null;
      }
      throw new Error(`Failed to get reference: ${await response.text()}`);
    }

    const data = await response.json();
    console.log('Successfully got reference:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('Error getting reference:', error);
    throw error;
  }
}

async function createGitHubReference(owner: string, repo: string, ref: string, sha: string, token: string) {
  console.log(`Creating reference refs/heads/${ref} in ${owner}/${repo} pointing to ${sha}`);
  
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: `refs/heads/${ref}`,
          sha: sha,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to create reference: ${await response.text()}`);
    }

    const data = await response.json();
    console.log('Successfully created reference:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('Error creating reference:', error);
    throw error;
  }
}

async function updateGitHubReference(owner: string, repo: string, ref: string, sha: string, token: string) {
  console.log(`Updating reference for ${owner}/${repo}#${ref} with SHA ${sha}`);
  
  try {
    const existingRef = await getGitHubReference(owner, repo, ref, token);
    
    if (!existingRef) {
      console.log(`Reference doesn't exist, creating new one`);
      return await createGitHubReference(owner, repo, ref, sha, token);
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${ref}`,
      {
        method: 'PATCH',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sha: sha,
          force: true,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update reference: ${await response.text()}`);
    }

    const data = await response.json();
    console.log('Successfully updated reference:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('Error updating reference:', error);
    throw error;
  }
}

async function getDefaultBranch(owner: string, repo: string, token: string) {
  console.log(`Getting default branch for ${owner}/${repo}`);
  
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      {
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get repository info: ${await response.text()}`);
    }

    const data = await response.json();
    console.log(`Default branch is: ${data.default_branch}`);
    return data.default_branch;
  } catch (error) {
    console.error('Error getting default branch:', error);
    throw error;
  }
}

async function performGitSync(operation: string, customUrl: string, masterUrl: string, githubToken: string) {
  // Validate URLs
  const customRepo = validateGitHubUrl(customUrl);
  const masterRepo = validateGitHubUrl(masterUrl);
  
  if (!customRepo || !masterRepo) {
    throw new Error('Invalid repository URLs provided');
  }

  // Get default branches
  const masterDefaultBranch = await getDefaultBranch(masterRepo.owner, masterRepo.repo, githubToken);
  const customDefaultBranch = await getDefaultBranch(customRepo.owner, customRepo.repo, githubToken);

  if (operation === 'pull') {
    // Get master branch reference
    const masterRef = await getGitHubReference(masterRepo.owner, masterRepo.repo, masterDefaultBranch, githubToken);
    if (!masterRef) {
      throw new Error('Master branch reference not found');
    }

    // Update or create custom branch reference
    await updateGitHubReference(customRepo.owner, customRepo.repo, customDefaultBranch, masterRef.object.sha, githubToken);
  } else if (operation === 'push') {
    // Get custom branch reference
    const customRef = await getGitHubReference(customRepo.owner, customRepo.repo, customDefaultBranch, githubToken);
    if (!customRef) {
      throw new Error('Custom branch reference not found');
    }

    // Update or create master branch reference
    await updateGitHubReference(masterRepo.owner, masterRepo.repo, masterDefaultBranch, customRef.object.sha, githubToken);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const githubToken = Deno.env.get('GITHUB_PAT');
    if (!githubToken) {
      throw new Error('GitHub token not configured');
    }

    const { operation, customUrl, masterUrl } = await req.json();

    console.log('Starting git sync operation...');

    // Create operation log
    const { data: { user } } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''));
    console.log('User authenticated:', user.id);

    // Validate URLs before proceeding
    if (!customUrl || (operation === 'push' && !masterUrl)) {
      throw new Error('Missing required URLs');
    }

    const customUrlValidation = validateGitHubUrl(customUrl);
    if (!customUrlValidation) {
      throw new Error('Invalid custom repository URL');
    }

    // Create log entry
    const { data: logEntry, error: logError } = await supabaseClient
      .from('git_sync_logs')
      .insert({
        operation_type: operation,
        status: 'completed',
        message: `Successfully verified access to ${customUrl}`,
        created_by: user.id,
      })
      .select()
      .single();

    if (logError) {
      throw logError;
    }

    console.log('Operation log created:', logEntry);

    if (masterUrl) {
      console.log(`Performing ${operation} between ${customUrl} and ${masterUrl}`);
      await performGitSync(operation, customUrl, masterUrl, githubToken);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in git-sync:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
})
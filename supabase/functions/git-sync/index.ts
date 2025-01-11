import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    // First check if the reference exists
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
  // Extract owner and repo from URLs
  const customMatch = customUrl.match(/github\.com\/([^\/]+)\/([^\.]+)(?:\.git)?$/);
  const masterMatch = masterUrl.match(/github\.com\/([^\/]+)\/([^\.]+)(?:\.git)?$/);
  
  if (!customMatch || !masterMatch) {
    throw new Error('Invalid repository URLs');
  }

  const [, customOwner, customRepo] = customMatch;
  const [, masterOwner, masterRepo] = masterMatch;

  // Get default branches
  const masterDefaultBranch = await getDefaultBranch(masterOwner, masterRepo, githubToken);
  const customDefaultBranch = await getDefaultBranch(customOwner, customRepo, githubToken);

  if (operation === 'pull') {
    // Get master branch reference
    const masterRef = await getGitHubReference(masterOwner, masterRepo, masterDefaultBranch, githubToken);
    if (!masterRef) {
      throw new Error('Master branch reference not found');
    }

    // Update or create custom branch reference
    await updateGitHubReference(customOwner, customRepo, customDefaultBranch, masterRef.object.sha, githubToken);
  } else if (operation === 'push') {
    // Get custom branch reference
    const customRef = await getGitHubReference(customOwner, customRepo, customDefaultBranch, githubToken);
    if (!customRef) {
      throw new Error('Custom branch reference not found');
    }

    // Update or create master branch reference
    await updateGitHubReference(masterOwner, masterRepo, masterDefaultBranch, customRef.object.sha, githubToken);
  }
}

async function verifyRepositoryAccess(owner: string, repo: string, token: string) {
  console.log(`Checking repository access: ${owner}/${repo}`);
  
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
      throw new Error(`Failed to access repository: ${await response.text()}`);
    }

    console.log('Repository access verified successfully');
  } catch (error) {
    console.error('Repository access verification failed:', error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Get the GitHub token from environment variables
    const githubToken = Deno.env.get('GITHUB_PAT');
    if (!githubToken) {
      throw new Error('GitHub token not configured');
    }

    // Get the request body
    const { operation, customUrl, masterUrl } = await req.json();

    console.log('Starting git sync operation...');

    // Create operation log
    const { data: { user } } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''));
    console.log('User authenticated:', user.id);

    console.log('Processing git sync operation:', { operation, customUrl, masterUrl });

    // Extract repository owner and name from custom URL
    const customMatch = customUrl.match(/github\.com\/([^\/]+)\/([^\.]+)(?:\.git)?$/);
    if (!customMatch) {
      throw new Error('Invalid repository URL');
    }
    const [, customOwner, customRepo] = customMatch;

    // Verify repository access
    await verifyRepositoryAccess(customOwner, customRepo, githubToken);

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

    // If masterUrl is provided, verify access and perform sync
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
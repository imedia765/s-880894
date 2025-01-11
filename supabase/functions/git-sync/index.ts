import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getGitHubReference(owner: string, repo: string, ref: string, githubToken: string) {
  console.log(`Getting reference for ${owner}/${repo}#${ref}`);
  
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${ref}`,
      {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Supabase-Edge-Function'
        }
      }
    );

    if (response.status === 404) {
      console.log(`Reference ${ref} not found in ${owner}/${repo}`);
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to get reference: ${errorText}`);
      throw new Error(`Failed to get reference: ${errorText}`);
    }

    const data = await response.json();
    console.log(`Successfully got reference:`, data);
    return data;
  } catch (error) {
    console.error('Error getting reference:', error);
    throw error;
  }
}

async function getLatestCommit(owner: string, repo: string, branch: string, githubToken: string) {
  console.log(`Getting latest commit for ${owner}/${repo}#${branch}`);
  
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/${branch}`,
      {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Supabase-Edge-Function'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to get latest commit: ${errorText}`);
      throw new Error(`Failed to get latest commit: ${errorText}`);
    }

    const data = await response.json();
    console.log(`Successfully got latest commit:`, data);
    return data.sha;
  } catch (error) {
    console.error('Error getting latest commit:', error);
    throw error;
  }
}

async function createGitHubReference(owner: string, repo: string, ref: string, sha: string, githubToken: string) {
  console.log(`Creating reference for ${owner}/${repo}#${ref} with SHA ${sha}`);
  
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Supabase-Edge-Function'
        },
        body: JSON.stringify({
          ref: `refs/heads/${ref}`,
          sha: sha
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to create reference: ${errorText}`);
      throw new Error(`Failed to create reference: ${errorText}`);
    }

    const data = await response.json();
    console.log(`Successfully created reference:`, data);
    return data;
  } catch (error) {
    console.error('Error creating reference:', error);
    throw error;
  }
}

async function updateGitHubReference(owner: string, repo: string, ref: string, sha: string, githubToken: string) {
  console.log(`Updating reference for ${owner}/${repo}#${ref} with SHA ${sha}`);
  
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${ref}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Supabase-Edge-Function'
        },
        body: JSON.stringify({
          sha: sha,
          force: true
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to update reference: ${errorText}`);
      throw new Error(`Failed to update reference: ${errorText}`);
    }

    const data = await response.json();
    console.log(`Successfully updated reference:`, data);
    return data;
  } catch (error) {
    console.error('Error updating reference:', error);
    throw error;
  }
}

async function getDefaultBranch(owner: string, repo: string, githubToken: string) {
  console.log(`Getting default branch for ${owner}/${repo}`);
  
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Supabase-Edge-Function'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to get repo info: ${errorText}`);
      throw new Error(`Failed to get repo info: ${errorText}`);
    }

    const data = await response.json();
    console.log(`Default branch is: ${data.default_branch}`);
    return data.default_branch;
  } catch (error) {
    console.error('Error getting default branch:', error);
    throw error;
  }
}

async function performGitSync(operation: string, customUrl: string, githubToken: string): Promise<void> {
  const [, customOwner, customRepo] = customUrl.match(/github\.com\/([^\/]+)\/([^\.]+)/) || [];
  const [, masterOwner, masterRepo] = MASTER_REPO.match(/github\.com\/([^\/]+)\/([^\.]+)/) || [];

  if (!customOwner || !customRepo || !masterOwner || !masterRepo) {
    throw new Error('Invalid repository URLs');
  }

  console.log(`Performing ${operation} between ${customUrl} and ${MASTER_REPO}`);

  // Get default branches
  const masterDefaultBranch = await getDefaultBranch(masterOwner, masterRepo, githubToken);
  const customDefaultBranch = await getDefaultBranch(customOwner, customRepo, githubToken);

  if (operation === 'pull') {
    // Get master branch reference
    const masterRef = await getGitHubReference(masterOwner, masterRepo, masterDefaultBranch, githubToken);
    if (!masterRef) {
      throw new Error('Master branch reference not found');
    }

    // Check if custom branch exists
    let customRef = await getGitHubReference(customOwner, customRepo, customDefaultBranch, githubToken);
    
    if (customRef) {
      // Update existing reference
      await updateGitHubReference(customOwner, customRepo, customDefaultBranch, masterRef.object.sha, githubToken);
    } else {
      // Get latest commit SHA from master
      const latestCommitSha = await getLatestCommit(masterOwner, masterRepo, masterDefaultBranch, githubToken);
      // Create new reference
      await createGitHubReference(customOwner, customRepo, customDefaultBranch, latestCommitSha, githubToken);
    }
  } else if (operation === 'push') {
    // Get custom branch reference
    const customRef = await getGitHubReference(customOwner, customRepo, customDefaultBranch, githubToken);
    if (!customRef) {
      throw new Error('Custom branch reference not found');
    }

    // Check if master branch exists
    let masterRef = await getGitHubReference(masterOwner, masterRepo, masterDefaultBranch, githubToken);
    
    if (masterRef) {
      // Update existing reference
      await updateGitHubReference(masterOwner, masterRepo, masterDefaultBranch, customRef.object.sha, githubToken);
    } else {
      // Get latest commit SHA from custom repo
      const latestCommitSha = await getLatestCommit(customOwner, customRepo, customDefaultBranch, githubToken);
      // Create new reference
      await createGitHubReference(masterOwner, masterRepo, masterDefaultBranch, latestCommitSha, githubToken);
    }
  }
}

const MASTER_REPO = 'https://github.com/imedia765/s-935078.git';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting git sync operation...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing required environment variables')
      throw new Error('Server configuration error')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('No authorization header')
      throw new Error('No authorization header')
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      console.error('Auth error:', authError)
      throw new Error('Invalid token')
    }

    console.log('User authenticated:', user.id)

    // Parse request body
    const { operation, customUrl } = await req.json()
    console.log('Processing git sync operation:', { operation, customUrl, masterUrl: MASTER_REPO })

    if (!operation || !customUrl) {
      throw new Error('Operation type and custom repository URL are required')
    }

    // Verify GitHub token exists
    const githubToken = Deno.env.get('GITHUB_PAT');
    if (!githubToken) {
      console.error('GitHub PAT not configured');
      throw new Error('GitHub token not configured');
    }

    // Create a log entry for the verification
    const { data: logEntry, error: logError } = await supabase
      .from('git_sync_logs')
      .insert({
        operation_type: operation,
        status: 'completed',
        created_by: user.id,
        message: `Successfully verified access to ${customUrl}`
      })
      .select()
      .single()

    if (logError) {
      console.error('Log creation error:', logError)
      throw new Error('Failed to create operation log')
    }

    console.log('Operation log created:', logEntry)

    // Perform the actual git operations
    await performGitSync(operation, customUrl, githubToken);

    // Create success log entry
    await supabase
      .from('git_sync_logs')
      .insert({
        operation_type: operation,
        status: 'completed',
        created_by: user.id,
        message: `Successfully synced ${operation === 'push' ? 'to' : 'from'} master repository`
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully processed ${operation} operation`,
        details: {
          operation,
          customUrl,
          masterUrl: MASTER_REPO
        }
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Error in git-sync:', error);

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        await supabase
          .from('git_sync_logs')
          .insert({
            operation_type: 'error',
            status: 'failed',
            message: error instanceof Error ? error.message : 'Unknown error',
            error_details: error instanceof Error ? error.stack : undefined
          })
      }
    } catch (logError) {
      console.error('Failed to create error log:', logError)
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})
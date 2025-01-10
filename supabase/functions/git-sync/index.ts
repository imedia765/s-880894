import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
    const { operation, customUrl, masterUrl } = await req.json()
    console.log('Processing git sync operation:', { operation, customUrl, masterUrl })

    if (!operation) {
      throw new Error('Operation type is required')
    }

    // For push operations, we need customUrl
    if (operation === 'push' && (!customUrl || customUrl.trim() === '')) {
      console.error('No custom repository URL provided')
      throw new Error('Custom repository URL is required for push operations')
    }

    // For pull operations, we need masterUrl
    if (operation === 'pull' && (!masterUrl || masterUrl.trim() === '')) {
      console.error('No master repository URL provided')
      throw new Error('Master repository URL is required for pull operations')
    }

    // Verify GitHub token exists
    const githubToken = Deno.env.get('GITHUB_PAT')
    if (!githubToken) {
      console.error('GitHub PAT not configured')
      throw new Error('GitHub token not configured')
    }

    // Verify repository access based on operation type
    const repoUrl = operation === 'push' ? customUrl : masterUrl;
    const repoPath = repoUrl.replace('https://github.com/', '').replace('.git', '')
    console.log('Checking repository access:', repoPath)
    
    const repoCheckResponse = await fetch(
      `https://api.github.com/repos/${repoPath}`,
      {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Supabase-Edge-Function'
        }
      }
    )

    if (!repoCheckResponse.ok) {
      const errorData = await repoCheckResponse.text()
      console.error('Repository check failed:', errorData)
      throw new Error(`Repository access failed: ${errorData}`)
    }

    console.log('Repository access verified successfully')

    // Create log entry
    const { data: logEntry, error: logError } = await supabase
      .from('git_sync_logs')
      .insert({
        operation_type: operation,
        status: 'completed',
        created_by: user.id,
        message: `Successfully verified access to ${operation === 'push' ? customUrl : masterUrl}`
      })
      .select()
      .single()

    if (logError) {
      console.error('Log creation error:', logError)
      throw new Error('Failed to create operation log')
    }

    console.log('Operation log created:', logEntry)

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Successfully processed ${operation} operation`,
        details: {
          operation,
          repository: operation === 'push' ? customUrl : masterUrl,
          logEntry
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
    console.error('Error in git-sync:', error)

    // Create error log entry
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
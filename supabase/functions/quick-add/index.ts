import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { OpenAI } from 'https://deno.land/x/openai@v4.20.1/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',  // Allow all headers - security is via token validation
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Verify the user
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      throw new Error('Invalid authorization token')
    }

    // Parse request body
    const { text, reminder_date, recurrence: clientRecurrence } = await req.json()
    if (!text || typeof text !== 'string') {
      throw new Error('Missing or invalid "text" field')
    }

    console.log(`Processing quick-add for user ${user.id}: "${text}"`)
    console.log('Client reminder_date:', reminder_date)
    console.log('Client recurrence:', JSON.stringify(clientRecurrence, null, 2))

    // Initialize OpenAI
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      throw new Error('OpenAI API key not configured')
    }
    const openai = new OpenAI({ apiKey: openaiKey })

    // Get user's lists (using service role, bypasses RLS)
    const { data: lists, error: listsError } = await supabase
      .from('lists')
      .select('id, name')
      .eq('user_id', user.id)
      .order('name')

    if (listsError) {
      console.error('Error fetching lists:', listsError)
      // Don't throw error if no lists, just continue with empty array
    }

    // Process text with AI for spell correction, list matching, and priority
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that processes task titles. You must:
1. Fix spelling mistakes
2. Capitalize ONLY the first letter and proper nouns (names, places)
3. Do NOT capitalize common words like: with, to, from, at, in, on, for, and, the, a, an
4. NEVER change URLs, domains, or email addresses - keep them exactly as typed
5. Match the task to the most appropriate list based on content and keywords
6. Determine priority based on urgency indicators:
   - "now" for: urgent, ASAP, immediately, today, critical, emergency, important, !!!, ***
   - "high" for: soon, tomorrow, this week, priority, deadline, !, **, HIGH
   - "low" for: everything else (default)

Return ONLY a JSON object in this exact format:
{"correctedText": "corrected task text", "listId": "matching-list-id", "priority": "now|high|low"}

NEVER add punctuation. Return ONLY the JSON object, nothing else.`
        },
        {
          role: "user",
          content: lists && lists.length > 0
            ? `Task: "${text}"\n\nAvailable lists:\n${lists.map(l => `- ${l.name} (id: ${l.id})`).join('\n')}\n\nProcess this task and return the JSON.`
            : `Task: "${text}"\n\nNo lists available. Process the task and return JSON with correctedText and priority only.`
        }
      ],
      temperature: 0.3,
      max_tokens: 200
    })

    let aiContent = aiResponse.choices[0]?.message?.content || '{}'
    aiContent = aiContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const parsed = JSON.parse(aiContent)

    let correctedText = parsed.correctedText || text
    let listId = parsed.listId
    const priority = parsed.priority || 'low'

    // NOW strip date/time patterns AFTER AI has processed the full context
    if (clientRecurrence?.originalText) {
      correctedText = correctedText.replace(clientRecurrence.originalText, '').trim()
      if (correctedText.length > 0) {
        correctedText = correctedText.charAt(0).toUpperCase() + correctedText.slice(1)
      }
    }

    // Verify list ID exists, otherwise use first list or create default
    if (!listId || !lists?.find(l => l.id === listId)) {
      if (lists && lists.length > 0) {
        listId = lists[0].id
      } else {
        // Create default list if none exist
        const { data: newList, error: createError } = await supabase
          .from('lists')
          .insert({ name: 'Personal', color: '#3B82F6', userId: user.id })
          .select()
          .single()

        if (createError) throw createError
        listId = newList.id
      }
    }

    // Use client-provided parsed data (clients handle ALL parsing now)
    // AI already cleaned the text - just use it as-is
    let extractedDate: Date | null = null
    let detectedRecurrence: any = null

    // Client provided pre-parsed recurrence
    if (clientRecurrence) {
      detectedRecurrence = clientRecurrence
    }
    // Client provided pre-parsed date
    else if (reminder_date) {
      extractedDate = new Date(reminder_date)
    }

    // Determine item type and status
    let type: 'task' | 'reminder' = 'task'
    let status = 'start'
    let reminderDate = null
    let recurrence = null

    const hasDate = extractedDate || detectedRecurrence

    if (hasDate) {
      type = 'reminder'

      if (detectedRecurrence) {
        // Recurring reminder - client already parsed everything
        recurrence = detectedRecurrence
        status = 'within7' // Default status for recurring

        // For interval-based (minutely/hourly), DO NOT set reminder_date
        // The recurrence object contains everything needed
        console.log('Recurring item - no reminder_date needed, only recurrence:', detectedRecurrence)
      } else if (extractedDate) {
        // Single date reminder - client already parsed
        reminderDate = extractedDate.toISOString()

        // Calculate status based on date
        const now = new Date()
        const diffDays = Math.ceil((extractedDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

        if (diffDays <= 1) {
          status = 'today'
        } else if (diffDays <= 7) {
          status = 'within7'
        } else {
          status = '7plus'
        }
      }
    }

    // Create the item (using snake_case for database columns)
    const itemData: any = {
      type,
      title: correctedText,
      priority,
      status,
      list_id: listId,
      user_id: user.id
    }

    if (reminderDate) {
      itemData.reminder_date = reminderDate
    }

    if (recurrence) {
      itemData.recurrence = recurrence
    }

    const { data: newItem, error: insertError } = await supabase
      .from('items')
      .insert(itemData)
      .select()
      .single()

    if (insertError) {
      console.error('Error creating item:', insertError)
      console.error('Item data that failed:', JSON.stringify(itemData, null, 2))
      throw new Error(`Failed to create item: ${insertError.message || JSON.stringify(insertError)}`)
    }

    console.log(`Successfully created item: ${newItem.id}`)

    return new Response(
      JSON.stringify({
        success: true,
        item: newItem  // Return complete item with all fields
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error in quick-add function:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message || 'An error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

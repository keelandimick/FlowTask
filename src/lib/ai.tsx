import React from 'react';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.REACT_APP_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Note: In production, you should use a backend proxy
});

interface ProcessedText {
  correctedText: string;
  hasLinks: boolean;
  suggestedListId?: string;
}

// Function to detect URLs in text
function detectUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?(?:\/[^\s]*)?)/g;
  return text.match(urlRegex) || [];
}

// Function to process text with AI and match to lists
export async function processTextWithAI(text: string, lists?: Array<{id: string, name: string}>): Promise<ProcessedText> {
  try {
    // First, correct the text
    const correctionResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that corrects spelling in task titles. 
          Rules:
          1. Fix spelling mistakes only
          2. Capitalize ONLY: 
             - The first letter of the whole text
             - Proper nouns (names like John, Sarah, Microsoft, Google)
             - Place names (New York, London, California)
          3. Do NOT capitalize common words like: with, to, from, at, in, on, for, and, the, a, an, need, want, should, must
          4. NEVER change anything in URLs, domains, or email addresses:
             - Keep ALL URLs exactly as typed (example.com, EXAMPLE.COM, Example.com stay as is)
             - Never capitalize any part of a web address or domain
             - If you see .com, .co, .org, www., http://, https:// - leave everything around it unchanged
          5. Return ONLY the corrected text
          6. NEVER add any punctuation
          7. Examples:
             - "talked with john" → "Talked with John"
             - "need to visit microsoft.com" → "Need to visit microsoft.com" (NOT Microsoft.com)
             - "check keelanscott.co website" → "Check keelanscott.co website"`
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0.3,
      max_tokens: 500
    });

    const correctedText = correctionResponse.choices[0]?.message?.content || text;
    let suggestedListId: string | undefined;
    
    // If lists are provided, find the best matching list
    if (lists && lists.length > 0) {
      const listMatchResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a helpful assistant that matches tasks to lists based on their content.
            Given a task title and available lists, choose the most appropriate list.
            
            Rules:
            1. Match based on context and keywords in the task
            2. Consider list names and what type of tasks would logically belong there
            3. Look for keywords that match list names (e.g., "business meeting" → Business list)
            4. Common patterns:
               - Business/Work lists: meetings, clients, projects, revenue, sales, office, work
               - Personal lists: family, friends, home, health, errands, personal
               - Shopping lists: buy, purchase, get, shop, store
            5. If no clear match, choose the list that seems most general (often "Personal" or the first list)
            6. You MUST return one of the provided list IDs exactly as shown
            7. Return ONLY the list ID, nothing else`
          },
          {
            role: "user",
            content: `Task: "${correctedText}"\n\nAvailable lists:\n${lists.map(l => `- ${l.name} (id: ${l.id})`).join('\n')}\n\nAnalyze the task content and match it to the most appropriate list based on keywords and context. Return only the ID.`
          }
        ],
        temperature: 0.3,
        max_tokens: 50
      });
      
      const matchedId = listMatchResponse.choices[0]?.message?.content?.trim();
      // Verify the ID exists in our lists
      if (matchedId && lists.find(l => l.id === matchedId)) {
        suggestedListId = matchedId;
      }
    }
    
    const urls = detectUrls(correctedText);
    
    return {
      correctedText: correctedText.trim(),
      hasLinks: urls.length > 0,
      suggestedListId
    };
  } catch (error) {
    console.error('AI processing error:', error);
    // Fallback to original text if AI fails
    return {
      correctedText: text,
      hasLinks: detectUrls(text).length > 0
    };
  }
}

// Function to render text with clickable links
export function renderTextWithLinks(text: string): React.ReactNode {
  // Simplified regex that matches full URLs
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?(?:\/[^\s]*)?)/g;
  
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  
  // Find all matches
  while ((match = urlRegex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      elements.push(text.substring(lastIndex, match.index));
    }
    
    // Add the link
    const url = match[0];
    const href = url.startsWith('http') ? url : `https://${url}`;
    elements.push(
      <a
        key={match.index}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 underline hover:text-blue-800"
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text after last match
  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }
  
  return <>{elements}</>;
}

// Function to categorize items using AI
export async function categorizeItems(
  items: Array<{id: string, title: string}>,
  listName: string
): Promise<Array<{id: string, category: string}>> {
  try {
    if (items.length === 0) {
      return [];
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that organizes tasks into categories.

Given a list of items and the list name, create 3-7 categories that make sense for organizing these items.
The categories should be:
1. Contextually appropriate for a "${listName}" list
2. Short and clear (1-3 words max)
3. Based on the actual items provided
4. Logical groupings that help organize the tasks

For example:
- "Personal" list might have: Shopping, Health, Home, Family, Errands
- "Work" list might have: Meetings, Projects, Admin, Clients
- "Fitness" list might have: Cardio, Strength, Meal Prep, Recovery

IMPORTANT RULES:
1. Consider the list name "${listName}" when creating categories
2. Don't create business/work categories for personal lists
3. Don't create personal/home categories for business lists
4. Create categories based on themes you see in the actual items
5. Each item must be assigned to exactly one category
6. You decide how many categories to create (3-7 range) based on item diversity

Return a JSON object with this exact format:
{
  "categories": ["Category1", "Category2", "Category3"],
  "assignments": [
    {"id": "item-id-1", "category": "Category1"},
    {"id": "item-id-2", "category": "Category2"}
  ]
}`
        },
        {
          role: "user",
          content: `List name: "${listName}"\n\nItems to categorize:\n${items.map(item => `- ${item.title} (id: ${item.id})`).join('\n')}\n\nCreate appropriate categories for this "${listName}" list and assign each item to a category. Return only the JSON object.`
        }
      ],
      temperature: 0.4,
      max_tokens: 2000
    });

    let content = response.choices[0]?.message?.content || '{"categories":[],"assignments":[]}';

    // Remove markdown code blocks if present
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    const parsed = JSON.parse(content);

    // Return the assignments
    return parsed.assignments || [];
  } catch (error) {
    console.error('Categorization error:', error);
    // Return uncategorized items on error
    return items.map(item => ({
      id: item.id,
      category: 'Uncategorized'
    }));
  }
}

// Function to extract tasks from image or text
export async function extractTasksFromImage(base64Image: string, _fileType: 'image' | 'pdf', lists: Array<{id: string, name: string}>): Promise<Array<{title: string, listId: string, priority: 'now' | 'high' | 'low'}>> {
  try {
    // For images, use GPT-4 Vision
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that extracts tasks from images or documents.
          Extract each task as a separate item. Clean up the text, fix spelling, and match each task to the most appropriate list.
          
          Available lists: ${lists.map(l => l.name).join(', ')}
          
          Return a JSON array of objects with format: [{"title": "task text", "listName": "matching list name", "priority": "now|high|low"}]
          
          Rules:
          1. Extract each task/to-do item as a separate entry
          2. Fix spelling and capitalize properly (first letter and proper nouns only)
          3. Match each task to the most appropriate list based on content
          4. Remove bullet points, numbers, or task markers
          5. Keep URLs exactly as written
          6. If no clear list match, use the first available list
          7. Assign priority based on urgency indicators:
             - "now" for: urgent, ASAP, immediately, today, critical, emergency, important, !!!, ***
             - "high" for: soon, tomorrow, this week, priority, deadline, !, **, HIGH
             - "low" for: everything else (default)
          8. Look for exclamation marks, ALL CAPS, or stars/asterisks as urgency indicators`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all tasks from this image:"
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 1500
    });

    let content = response.choices[0]?.message?.content || '[]';
    
    // Remove markdown code blocks if present
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    const parsedTasks = JSON.parse(content);
    
    // Map list names back to IDs and ensure priority
    return parsedTasks.map((task: any) => {
      const matchingList = lists.find(l => l.name.toLowerCase() === task.listName.toLowerCase());
      return {
        title: task.title,
        listId: matchingList?.id || lists[0]?.id,
        priority: task.priority || 'low'
      };
    });
  } catch (error) {
    console.error('Task extraction error:', error);
    return [];
  }
}
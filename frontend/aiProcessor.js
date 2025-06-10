// In aiProcessor.js - improved version
export function preprocessChatForAI(text) {
  if (typeof text !== 'string') throw new Error('Input must be a string');
  const lines = text.split('\n');
  const participants = new Set();
  const regex = window.chatFormat === 'bracket' 
      ? /\[(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2})(?::(\d{2}))?\] ([^:]+):/
      : /^(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2})(?::(\d{2}))? - ([^:]+):/;
  const participantOrder = [];
  for (const line of lines) {
      const match = line.match(regex);
      if (match) {
          const sender = match[7].trim();
          if (!participants.has(sender)) {
              participants.add(sender);
              participantOrder.push(sender);
              if (participantOrder.length === 2) break;
          }
      }
  }
  if (participantOrder.length !== 2) return null;
  const [personA, personB] = participantOrder;
  let processedText = '';
  let processedCount = 0;
  for (const line of lines) {
      const match = line.match(regex);
      if (match) {
          const num1 = match[1];
          const num2 = match[2];
          const hour = match[4];
          const minute = match[5];
          const sender = match[7].trim();
          const message = line.split(': ').slice(1).join(': ');
          const day = window.dateFormat === 'US' ? num2 : num1;
          const month = window.dateFormat === 'US' ? num1 : num2;
          processedText += `[${day}/${month} ${hour}:${minute}] ${sender}: ${message}\n`;
          processedCount++;
          if (processedCount >= 5000) break;
      }
  }
  return {
      processedText,
      originalNames: { 
          personA, 
          personB,
          _meta: { determinedBy: "first_appearance", regionUsed: window.dateFormat }
      }
  };
}
export async function analyzeWithAI(preprocessedText) {
  try {
    const prompt = `Please analyze the following chat log and provide detailed insights into the relationship dynamics between the two participants. Your analysis should include:

1. Overall Connection:
   - **Label:** Select one from: Strangers, Acquaintances, Friends, Close Friends, Lovers, Romantic Tension, or Conflictual.
   - **Explanation:** Provide a brief rationale for your chosen label based on the chat log.

2. Chat Overview:
   - **Description:** Provide a comprehensive overview of the chat log. Focus on highlighting recurring themes, the overall mood, who is the most engaged, patterns, and any emerging topics or trends noticed throughout the conversation.

3. Evolution of Interaction:
   - **Description:** Describe how the communication style and connection evolve throughout the chat, make sure to not mention unrelated messages, eg: such as the whatsapp encryption.

4. Personalized Analysis for Each Participant:
   For each participant, include:
   - **Interest Level:** Rate their level of interest on a scale from 0 to 10, be extremely honest, and give 9 and 10 only to those who are in love or seem extremely interested.
   - **Communication Style:** Describe their general traits and emotional depth.
   - **Green Flags:** Identify two positive signals (with title and indightful description).
   - **Red Flags:** Identify two potential concerns (with title and indightful description). Do not mistake humor for serious communication.
   - **Relationship Tip:** Offer one actionable suggestion (with title and description).

"5. Response Analysis:
   - **Explanation:** Provide a brief explanation of the response patterns between the two participants, focusing on qualitative observations (for example, delays or notable interaction patterns).

6. Conversation Dynamics:
   - **Initiation Analysis:** Analyze who tends to initiate conversations more frequently and describe their initiation style or patterns, include a percentage of who initiates more for both participants, making sure that the total is 100%.
   - **Ending Analysis:** Analyze who tends to end conversations more frequently and describe how they typically end conversations, especially focusing on instances where conversations end due to lack of response, dry replies, or being non-responsiveinclude a percentage of who initiates more for both participants, making sure that the total is 100%.

7. Emotional Heatmap:
   - Analyze the emotional tone throughout the conversation divided into 10 equal time segments
   - For each segment, provide a score from 0 to 10 where:
     - 0-4: Negative/conflictual
     - 5-8: Neutral/positive
     - 9-10: Loving/romantic
   - The scores should reflect the overall emotional tone of that period

****Guidelines:****
- Never quote directly from the chat log.
- Be very careful to avoid mistaking irony, sarcasm, or humor for serious communication.
- If both participants are communicating in an unusual tone, do not include it in the analysis.
- Use the names of the participants as they appear in the chat log; if a name is too long, abbreviate it.
- Avoid using pronouns such as "her", "she", etc.
- Make your analysis as detailed and insightful as possible, adding depth to your observations.
- Make sure not to state the obvious, but to reach deeper into the chat, searching for patterns and meanings, that are not immediately visible.
- Respond in a casual/friendly tone, and dig deeper into the chat, making sure to analyze the chat completely.
- Dont include any slashes or any other symbols in the analysis.
- Be Confident and Honest.

Return your analysis STRICTLY in the following JSON format and be honest, (if the person's name is way too long, just slightly abbreviate it):

{
  "overallConnection": { "label": "", "explanation": "" },
  "chatOverview": { "description": "" },
  "evolution": { "description": "" },
  {
  "responseAnalysis": {
    "participantA": { "explanation": "Some analysis text"},
    "participantB": { "explanation": "Some analysis text"}
  }
}
"conversationDynamics": {
  "initiation": {
    "participantA": 0,
    "participantB": 0,
    "analysis": ""
  },
  "ending": {
    "participantA": 0,
    "participantB": 0,
    "analysis": ""
  }
},
"emotionalHeatmap": [0, 1, 2, 3, 10, 9, 4, 3, 2, 1] (example format - provide actual scores)
"participants": [
    {
      "name": "Person",
      "interestLevel": 0,
      "communicationStyle": { "generalTraits": "", "trustAndEmotionalDepth": "" },
      "greenFlags": [ { "title": "", "description": "" }, { "title": "", "description": "" } ],
      "redFlags": [ { "title": "", "description": "" }, { "title": "", "description": "" } ],
      "relationshipTip": { "title": "", "description": "" }
    },
    {
      "name": "Person",
      "interestLevel": 0,
      "communicationStyle": { "generalTraits": "", "trustAndEmotionalDepth": "" },
      "greenFlags": [ { "title": "", "description": "" }, { "title": "", "description": "" } ],
      "redFlags": [ { "title": "", "description": "" }, { "title": "", "description": "" } ],
      "relationshipTip": { "title": "", "description": "" }
    }
  ]
}
Chat Log:
${preprocessedText}`;

    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatText: prompt }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    let result;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      result = await response.json();
    } else {
      result = await response.text();
      try {
        result = JSON.parse(result);
      } catch (e) {
        throw new Error('Invalid JSON response from server');
      }
    }

    if (result.responseAnalysis) {
      Object.keys(result.responseAnalysis).forEach(person => {
        if ('averageResponseTime' in result.responseAnalysis[person]) {
          delete result.responseAnalysis[person].averageResponseTime;
        }
      });
    }

    // Log the AI response to the console
    console.log('AI Response:', result);

    return result;
  } catch (error) {
    console.error('AI analysis failed:', error);
    throw error;
  }
}

// In aiProcessor.js - add this new function
export function preprocessGroupChat(text, region) {
  if (typeof text !== 'string') {
    throw new Error('Input must be a string');
  }

  const lines = text.split('\n');
  const participants = new Set();
  const regex = /\[(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2}):(\d{2})\] ([^:]+):/;
  
  // First pass to identify all participants
  for (const line of lines) {
    const match = line.match(regex);
    if (match) {
      const sender = match[7].trim();
      participants.add(sender);
    }
  }
  
  // Only proceed if more than 2 participants
  if (participants.size <= 2) {
    return null;
  }
  
  let processedText = '';
  let processedCount = 0;
  
  // Second pass to process lines with proper date handling
  for (const line of lines) {
    const match = line.match(regex);
    if (match) {
      // Handle both US (MM/DD/YYYY) and EU (DD/MM/YYYY) formats
      const day = region === "US" ? match[2] : match[1];
      const month = region === "US" ? match[1] : match[2];
      const hour = match[4];
      const minute = match[5];
      const sender = match[7].trim();
      const message = line.split(': ').slice(1).join(': ');

      processedText += `[${day}/${month} ${hour}:${minute}] ${sender}: ${message}\n`;
      processedCount++;
      
      if (processedCount >= 5000) break;
    }
  }
  
  return {
    processedText,
    participantCount: participants.size,
    participantNames: Array.from(participants)
  };
}

// Add this new function for group chat analysis
export async function analyzeGroupChatWithAI(preprocessedText) {
  try {
    const prompt = `Please analyze the following group chat log and provide an insightful overview. Your analysis should focus on:

1. Group Dynamics:
   - Describe the overall group interaction patterns
   - Identify any notable sub-groups or frequent interactions
   - Highlight the most active and least active participants

2. Conversation Themes:
   - Identify 3-5 main topics that dominate the conversation
   - Note any recurring subjects or inside jokes

3. Engagement Analysis:
   - Describe how engagement varies among participants
   - Note any patterns in response times or message lengths

4. Group Personality:
   - Characterize the overall tone of the group (e.g., formal, casual, humorous)
   - Identify any dominant personalities or leaders

***Guidelines:***
- Never quote directly from the chat log
- Focus on group-level patterns rather than individual relationships
- Be objective and avoid making assumptions about personal relationships
- Keep the analysis concise but insightful

Return your analysis in the following JSON format:
{
  "groupDynamics": "",
  "conversationThemes": [],
  "engagementAnalysis": "",
  "groupPersonality": ""
}

Group Chat Log:
${preprocessedText}`;

    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatText: prompt }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Group chat AI analysis failed:', error);
    throw error;
  }
}
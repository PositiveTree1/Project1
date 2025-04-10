// In aiProcessor.js - improved version
export function preprocessChatForAI(text, region) {
  if (typeof text !== 'string') {
    throw new Error('Input must be a string');
  }

  const lines = text.split('\n');
  const participants = new Set();
  const regex = /\[(\d{1,2})\/(\d{1,2})\/(\d{4}), (\d{1,2}):(\d{2}):(\d{2})\] ([^:]+):/;
  
  // Track participants in order of first appearance
  const participantOrder = [];
  
  // First pass to identify participants in order
  for (const line of lines) {
    const match = line.match(regex);
    if (match) {
      const sender = match[7].trim();
      if (!participants.has(sender)) {
        participants.add(sender);
        participantOrder.push(sender);
        // Exit early once we have 2 participants
        if (participantOrder.length === 2) break;
      }
    }
  }
  
  // Only proceed if exactly 2 participants
  if (participantOrder.length !== 2) {
    return null;
  }
  
  const [personA, personB] = participantOrder;
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

      // Use original names in the processed text
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
      // Add metadata about the order determination
      _meta: {
        determinedBy: "first_appearance",
        regionUsed: region
      }
    }
  };
}
  
export async function analyzeWithAI(preprocessedText) {
  try {
    const prompt = `Please analyze the following chat log and provide detailed insights into the relationship dynamics between the two participants. Your analysis should include:
    
1. Overall Connection:
   - **Label:** Select one from: Strangers, Acquaintances, Friends, Close Friends, Lovers, Romantic Tension, or Conflictual.
   - **Explanation:** Provide a brief rationale for your chosen label based on the chat log.

2. Evolution of Interaction:
   - **Description:** Describe how the communication style and connection evolve throughout the chat, make sure to not mention unrelated messages, eg: such as the whatsapp encryption.

3. Personalized Analysis for Each Participant:
   For each participant, include:
   - **Interest Level:** Rate their level of interest on a scale from 0 to 10, be extremely honest.
   - **Communication Style:** Describe their general traits and emotional depth.
   - **Green Flags:** Identify two positive signals (with title and description).
   - **Red Flags:** Identify two potential concerns (with title and description). Do not mistake humor for serious communication.
   - **Relationship Tip:** Offer one actionable suggestion (with title and description).

4. Response Analysis:
   - **Explanation:** Provide a brief explanation of the response patterns between the two participants, focusing on qualitative observations (for example, delays or notable interaction patterns).

***Guidelines:***
- Never quote directly from the chat log.
- Be very careful to avoid mistaking irony, sarcasm, humour for serious communication.
- If both participants are communicating in an unusual tone, dont include it in the analysis.
- When giving the analysis, use the names of the participants as they appear in the chat log, and if the name is too long, use an abbreviation.
- When giving the analysis, never use any pronouns such as "her", "she" etc.
- Make your analysis as detailed and insightful as possible, adding depth to your observations.

Return your analysis strictly in the following JSON format, if the persons name is too long, find a way to abbreviate it:

{
  "overallConnection": { "label": "", "explanation": "" },
  "evolution": { "description": "" },
  "responseAnalysis": {
    "participantA": { "explanation": "" },
    "participantB": { "explanation": "" }
  },
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

    const contentType = response.headers.get('content-type');
    let result;
    if (contentType && contentType.includes('application/json')) {
      result = await response.json();
    } else {
      const text = await response.text();
      try {
        result = JSON.parse(text);
      } catch (e) {
        result = {
          overallConnection: { label: "Analysis Result", explanation: text },
          evolution: { description: "See detailed analysis above" },
          participants: []
        };
      }
    }

    // Log the AI response to the console
    console.log('AI Response:', result);

    return result;
  } catch (error) {
    console.error('AI analysis failed:', error);
    throw error;
  }
}
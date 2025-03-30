// In aiProcessor.js - modify the preprocessChatForAI function
export function preprocessChatForAI(text, region) {
  if (typeof text !== 'string') {
    throw new Error('Input must be a string');
  }

  // Extract participants and replace with A/B
  const lines = text.split('\n');
  const participants = new Set();
  const regex = /\[(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})\] ([^:]+):/;
  
  // First pass to identify participants
  lines.forEach(line => {
    const match = line.match(regex);
    if (match) {
      participants.add(match[7].trim());
    }
  });
  
  // Only proceed if exactly 2 participants
  if (participants.size !== 2) {
    return null;
  }
  
  const [personA, personB] = Array.from(participants);
  let processedText = '';
  let processedCount = 0;
  
  // Second pass to process lines (include simplified date/time)
  lines.forEach(line => {
    const match = line.match(regex);
    if (match) {
      const day = match[1];
      const month = match[2];
      const year = match[3];
      const hour = match[4];
      const minute = match[5];
      const sender = match[7].trim();
      const message = line.split(': ').slice(1).join(': ');
      const replacement = sender === personA ? 'A' : 'B';
      
      // Include simplified timestamp [DD/MM HH:mm]
      processedText += `[${day}/${month} ${hour}:${minute}] ${replacement}: ${message}\n`;
      processedCount++;
      
      // Limit to 5000 messages to manage token usage
      if (processedCount >= 5000) return;
    }
  });
  
  return {
    processedText,
    originalNames: { personA, personB }
  };
}

  
export async function analyzeWithAI(preprocessedText) {
  try {
    const prompt = `Please analyze the following chat log and provide detailed insights into the relationship dynamics between the two participants. Your analysis should include:
    
1. Overall Connection:
   - **Label:** Select one from: Strangers, Acquaintances, Friends, Close Friends, Lovers, Romantic Tension, or Conflictual.
   - **Explanation:** Provide a brief rationale for your chosen label based on the chat log.

2. Evolution of Interaction:
   - **Description:** Describe how the communication style and connection evolve throughout the chat.

3. Personalized Analysis for Each Participant:
   For each participant, include:
   - **Interest Level:** Rate their level of interest on a scale from 0 to 10.
   - **Communication Style:** Describe their general traits and emotional depth.
   - **Green Flags:** Identify two positive signals (with title and description).
   - **Red Flags:** Identify two potential concerns (with title and description).
   - **Relationship Tip:** Offer one actionable suggestion (with title and description).

4. Response Analysis:
   - **Explanation:** Provide a brief explanation of the response patterns between the two participants, focusing on qualitative observations (for example, delays or notable interaction patterns) without including numerical estimates.

***Guidelines:***
- Be very careful to avoid mistaking irony, sarcasm, humour for serious communication.
- If both participants are communicating in an unusual tone, dont include it in the analysis.
- Instead of refering to the participants by name, use "This person", or "The other person".

Return your analysis strictly in the following JSON format, while using “This person” and "The other person" for all references:

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
    return result;
  } catch (error) {
    console.error('AI analysis failed:', error);
    throw error;
  }
}
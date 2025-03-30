const express = require('express');
const path = require('path');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();


// Initialize Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// 1. Serve static files from frontend directory
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// 2. API Routes
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'AIzaSyDP6zuw7hLitN7Vj1RwReRsvSSCWdT9hYE');
const modelConfig = {
    model: "gemini-1.5-flash",
    generationConfig: {
      temperature: 0,
      topP: 1,
      topK: 32,
      maxOutputTokens: 8192,
      seed: 42,
    },
};
  

app.post('/api/analyze', async (req, res) => {
  try {
    const { chatText } = req.body;
    if (!chatText) return res.status(400).json({ error: 'No chat text provided' });
    
    const model = genAI.getGenerativeModel(modelConfig);
    const result = await model.generateContent(chatText);
    const response = await result.response;
    const text = response.text();
    
    try {
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return res.json(JSON.parse(cleanJson));
    } catch (e) {
      console.error("Failed to parse JSON:", text);
      return res.status(500).json({ error: "AI response format error" });
    }
  } catch (error) {
    console.error("AI error:", error);
    return res.status(500).json({ error: "AI analysis failed" });
  }
});

// 3. Fallback route - serve index.html for all other requests
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://192.168.1.225:${PORT}`);
});

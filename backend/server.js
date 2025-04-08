const express = require('express');
const path = require('path');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Initialize Express
const app = express();

// Middleware
app.use(cors());
// Increase payload size limit (50MB) using Express's built-in parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from frontend directory
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// API Routes
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

// Fallback routes
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.get('/analyze', (req, res) => {
  res.sendFile(path.join(frontendPath, 'analyze.html'));
});

const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

app.post('/api/verify-google-token', async (req, res) => {
    try {
        const { token } = req.body;
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();
        res.json({ 
            success: true, 
            user: {
                id: payload.sub,
                name: payload.name,
                email: payload.email,
                picture: payload.picture
            }
        });
    } catch (error) {
        console.error('Token verification failed:', error);
        res.status(400).json({ success: false, error: 'Invalid token' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://192.168.1.225:${PORT} or http://localhost:3000`);
});
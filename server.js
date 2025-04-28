const path        = require('path');
const express     = require('express');
const cors        = require('cors');
const admin       = require('firebase-admin');
require('dotenv').config();

// ————————————— Initialize Firebase Admin —————————————
const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});
const db = admin.firestore();
console.log('🔥 Firestore ready for project:', serviceAccount.project_id);

// ————————————— Initialize Express —————————————
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// ————————————— 1️⃣ Serve static frontend files —————————————
// Anything under `frontend/` (including /scripts, /styles, /favicon.png, index.html, etc.)
const frontendPath = path.join(__dirname, 'frontend');
app.use(express.static(frontendPath));


const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();



app.post('/api/save-analysis', async (req, res) => {
  const { userId, analysisData } = req.body;
  if (!userId || !analysisData) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const doc = await db.collection('chatAnalyses').add({
      userId,
      analysisData,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    res.json({ success: true, id: doc.id });
  } catch (e) {
    console.error('❌ Save failed:', e);
    res.status(500).json({ error: 'Failed to save analysis' });
  }
});

// Get analyses (updated version)
app.get('/api/get-analyses/:userId', async (req, res) => {
  try {
    const snapshot = await db
      .collection('chatAnalyses')
      .where('userId', '==', req.params.userId)
      .orderBy('createdAt','desc')
      .get();

    const analyses = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(analyses);
  } catch (e) {
    console.error('❌ Fetch failed:', e);
    res.status(500).json({ error: 'Failed to get analyses' });
  }
});

app.delete('/api/delete-analysis/:id', async (req, res) => {
  try {
    await db.collection('chatAnalyses').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e) {
    console.error('❌ Delete failed:', e);
    res.status(500).json({ error: 'Failed to delete analysis' });
  }
});

// Middleware
app.use(cors());
// Increase payload size limit (50MB) using Express's built-in parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));



// API Routes
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'AIzaSyBHqaEt5hYdEc1oErBctkz7ygjenOgL5Hk');
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

app.get('/api/user-credits/:userId', async (req, res) => {
  try {
      const { userId } = req.params;
      const userRef = db.collection('users').doc(userId);
      const doc = await userRef.get();
      
      if (!doc.exists) {
          return res.json({ credits: 0 });
      }
      
      res.json({ credits: doc.data().credits || 0 });
  } catch (error) {
      console.error('Error getting user credits:', error);
      res.status(500).json({ error: 'Failed to get user credits' });
  }
});

// Update user credits
app.post('/api/update-credits', async (req, res) => {
  try {
      const { userId, amount } = req.body;
      const userRef = db.collection('users').doc(userId);
      
      await userRef.set({
          credits: admin.firestore.FieldValue.increment(amount),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      
      res.json({ success: true });
  } catch (error) {
      console.error('Error updating credits:', error);
      res.status(500).json({ error: 'Failed to update credits' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.get('/analyze', (req, res) => {
  res.sendFile(path.join(frontendPath, 'analyze.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://192.168.1.225:${PORT} or http://localhost:3000`);
});
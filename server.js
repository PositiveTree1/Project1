require('dotenv').config();
const express = require('express');
const app     = express();
const cors    = require('cors');
const path    = require('path');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const TelegramBot = require('node-telegram-bot-api');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN);


// Add webhook endpoint to handle payment completion
app.post('/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
  console.log('🔔 stripe-webhook hit!', {
      sig: req.headers['stripe-signature'],
      rawBodyLength: req.body.length
  });
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    // Fulfill the purchase
    await fulfillOrder(session);
  }

  res.json({received: true});
});

// 1️⃣ Apply these *before* any `app.post(…)` or `app.get(…)`
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 2️⃣ Now require Stripe, Firebase, etc.

const admin  = require('firebase-admin');

// Accept client-side error reports
app.post('/api/log-client-error', express.json(), async (req, res) => {
    try {
        const { userId, message, source, stack, context } = req.body;
        
        // Log to database
        await db.collection('clientErrors').add({
            userId: userId || null,
            message,
            source,
            stack: stack || null,
            context,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Send to Telegram
        await notifyError(new Error(message), {
            source,
            stack,
            ...context
        }, userId);
        
        res.json({ success: true });
    } catch (err) {
        console.error('❌ Failed to log client error:', err);
        res.status(500).json({ error: 'Logging failed' });
    }
});

// Add this near the top of your server.js
app.use((err, req, res, next) => {
    console.error('❌ Global error handler:', err);
    
    // Send error to Telegram
    notifyError(err, {
        path: req.path,
        method: req.method,
        body: req.body,
        headers: req.headers
    }, req.body?.userId || req.params?.userId || null);
    
    res.status(500).json({ error: 'Something went wrong' });
});




function requireAuth(req, res, next) {
  const userId = req.body?.userId || req.params?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  return next();
}


// … somewhere at the top of server.js:
// (No need to import anything else; Node 18+ has global fetch.)



// Add this near the top of server.js
app.use((req, res, next) => {
  // Extract language from Accept-Language header or default to English
  const acceptLanguage = req.headers['accept-language'] || 'en';
  let lang = 'en';
  
  // Simple language detection
  if (acceptLanguage.includes('fr')) {
    lang = 'fr';
  } else if (acceptLanguage.includes('es')) {
    lang = 'es';
  } else if (acceptLanguage.includes('de')) {
    lang = 'de';
  }
  
  req.lang = lang;
  next();
});


// ─────────── 7️⃣ CREATE‐CHECKOUT ENDPOINT ───────────
// In server.js, replace the PLAN_PRICES_USD section with:
const PLAN_PRICES = {
  basic: {
    usd: 0.99,
    gbp: 0.99,
    originalUsd: 2.99,
    originalGbp: 2.99,
    credits: 40
  },
  power: {
    usd: 1.99,
    gbp: 1.99,
    originalUsd: 6.49,
    originalGbp: 6.49,
    credits: 95
  },
  premium: {
    usd: 2.99,
    gbp: 2.99,
    originalUsd: 9.99,
    originalGbp: 9.99,
    credits: 170
  }
};
app.post('/create-stripe-session', async (req, res) => {
  console.log('→ [create-stripe-session] req.body:', JSON.stringify(req.body));
  console.log('→ [create-stripe-session] x-user-id header:', req.headers['x-user-id']);

  try {
    const { plan, name } = req.body;
    const userId = req.headers['x-user-id'];
    const clientCurrency = (req.body.currency || 'USD').toUpperCase();

    // Validate userId
    if (!userId) {
      console.error('❌ Missing userId in headers');
      return res.status(400).json({ error: 'User not authenticated' });
    }

    // Validate plan
    if (!plan || !PLAN_PRICES[plan]) {
      console.error('❌ Unknown or missing plan:', plan);
      return res.status(400).json({ error: 'Unknown plan.' });
    }

    // Validate currency
    const allowed = ['USD', 'GBP'];
    if (!allowed.includes(clientCurrency)) {
      console.error(`❌ Unsupported currency: "${clientCurrency}"`);
      return res.status(400).json({ error: 'Unsupported currency' });
    }

    // Get price details
    const priceDetails = PLAN_PRICES[plan];
    const finalCurrency = clientCurrency;
    const minorUnit = Math.round((finalCurrency === 'GBP' ? priceDetails.gbp : priceDetails.usd) * 100);
    const credits = priceDetails.credits;

    // Build URLs
    const successUrl = `${process.env.FRONTEND_URL}/credits.html?success=true&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${process.env.FRONTEND_URL}/credits.html?canceled=true`;

    // Create Stripe session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: finalCurrency.toLowerCase(),
          product_data: {
            name: `${name} Plan - ${plan.charAt(0).toUpperCase() + plan.slice(1)}`,
          },
          unit_amount: minorUnit,
        },
        quantity: 1
      }],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId,
        creditAmount: credits,
        planId: plan,
        currency: finalCurrency
      }
    });

    console.log('→ Created Stripe session successfully:', session.id);
    return res.json({ id: session.id });
  } catch (err) {
    console.error('❌ [create-stripe-session] Uncaught error:', err);
    return res.status(500).json({ error: 'Failed to create payment session' });
  }
});




// ————————————— Initialize Firebase Admin —————————————
let db;
try {
  const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
  console.log('🔍 Loading service account from:', serviceAccountPath);

  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
  db = admin.firestore();
  console.log('✅ Firebase Admin initialized for project:', serviceAccount.project_id);

} catch (err) {
  console.error('❌ Firebase Admin failed to initialize:', err);
  // Crash immediately—to avoid 500s on every endpoint
  process.exit(1);
}

async function fulfillOrder(session) {
  const userId = session.metadata.userId;
  const creditAmount = parseInt(session.metadata.creditAmount);
  
  try {
    // Update user's credits in Firestore
    const userRef = db.collection('users').doc(userId);
    await userRef.update({
      credits: admin.firestore.FieldValue.increment(creditAmount),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`Successfully added ${creditAmount} credits to user ${userId}`);
  } catch (err) {
    console.error('❌ Firestore update failed:', err);
    // In a production app, you should have retry logic here
  }
}



// ————————————— Initialize Express —————————————



// ————————————— 1️⃣ Serve static frontend files —————————————
// Anything under `frontend/` (including /scripts, /styles, /favicon.png, index.html, etc.)
const frontendPath = path.join(__dirname, 'frontend');
app.use(express.static(frontendPath));


const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

app.post('/api/save-analysis', async (req, res) => {
  const { userId, analysisData, basic } = req.body;
  if (!userId || !analysisData) return res.status(400).json({ error: 'Missing fields' });

  try {
    const userRef = db.collection('users').doc(userId);
    let expiresAtField = {};
    
    // Only set expiration if it's a basic chat AND not marked as AI
    if (basic === true && !analysisData.html.includes('ai-analysis-complete')) {
      const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 2880 * 60 * 1000)); // 2 days
      expiresAtField = { expiresAt };
    } 
    
    
    const docRef = await userRef
      .collection('analyses')
      .add({
        analysisData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...expiresAtField
      });
    res.json({ success: true, id: docRef.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save analysis' });
  }
});
// Add these new endpoints to server.js

// GET /api/check-consent/:userId
app.get('/api/check-consent/:userId', async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.params.userId).get();
    if (!doc.exists) {
      return res.json({ hasConsented: false });
    }
    const userData = doc.data();
    return res.json({ hasConsented: userData.aiConsent === true });
  } catch (err) {
    console.error('Error checking consent:', err);
    return res.status(500).json({ error: 'Failed to check consent' });
  }
});

app.post('/api/notify-upload', async (req, res) => {
    try {
        const { userId, fileName, fileSize, previewLines } = req.body;
        await notifyFileUpload(userId, fileName, fileSize, previewLines);
        res.json({ success: true });
    } catch (err) {
        console.error('Upload notification failed:', err);
        await notifyError(err, { endpoint: '/api/notify-upload', body: req.body }, userId);
        res.status(500).json({ error: 'Notification failed' });
    }
});

// Helper function to format file size
function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function notifyLogin(user) {
    try {
        const usersRef = db.collection('users');
        const snapshot = await usersRef.count().get();
        const totalUsers = snapshot.data().count;

        await bot.sendMessage(
            TELEGRAM_CHAT_ID,
            `🔔 New login:\n` +
            `👤 Name: ${user.name}\n` +
            `📧 Email: ${user.email}\n` +
            `🆔 User ID: ${user.id}\n\n` +
            `📊 Total Users: ${totalUsers}`
        );
    } catch (err) {
        console.error('Telegram login notification failed:', err);
    }
}

async function notifyFileUpload(userId, fileName, fileSize, previewLines) {
    try {
        let userInfo = 'Anonymous';
        if (userId) {
            const userDoc = await db.collection('users').doc(userId).get();
            if (userDoc.exists) {
                const user = userDoc.data();
                userInfo = `${user.name || 'Unknown'} (${user.email || 'no email'})`;
            }
        }

        const previewText = Array.isArray(previewLines) 
            ? previewLines.join('\n')
            : '[No preview available]';

        await bot.sendMessage(
            TELEGRAM_CHAT_ID,
            `📤 New file uploaded:\n` +
            `👤 User: ${userInfo}\n` +
            `📄 File: ${fileName} (${formatFileSize(fileSize)})\n` +
            `🔍 Preview:\n${previewText.substring(0, 200)}`
        );
    } catch (err) {
        console.error('Telegram file upload notification failed:', err);
    }
}

async function notifyAnalysisComplete(userId, analysisType, participants, isGroupChat, preview) {
    try {
        let userInfo = 'Anonymous';
        if (userId) {
            const userDoc = await db.collection('users').doc(userId).get();
            if (userDoc.exists) {
                const user = userDoc.data();
                userInfo = `${user.name || 'Unknown'} (${user.email || 'no email'})`;
            }
        }

        await bot.sendMessage(
            TELEGRAM_CHAT_ID,
            `📊 Analysis completed:\n` +
            `👤 User: ${userInfo}\n` +
            `🔍 Type: ${analysisType}\n` +
            `👥 Participants: ${participants.join(', ')}\n` +
            `📊 Group chat: ${isGroupChat ? 'Yes' : 'No'}\n` +
            `🔍 Preview:\n${preview.substring(0, 200)}...`
        );
    } catch (err) {
        console.error('Telegram analysis notification failed:', err);
    }
}

async function notifyError(error, context = {}, userId = null) {
    try {
        let userInfo = 'Anonymous';
        if (userId) {
            const userDoc = await db.collection('users').doc(userId).get();
            if (userDoc.exists) {
                const user = userDoc.data();
                userInfo = `${user.name || 'Unknown'} (${user.email || 'no email'})`;
            }
        }

        await bot.sendMessage(
            TELEGRAM_CHAT_ID,
            `❌ Error occurred:\n` +
            `👤 User: ${userInfo}\n` +
            `💥 Error: ${error.message || error}\n` +
            `📌 Context: ${JSON.stringify(context, null, 2)}\n` +
            `🔗 Stack: ${error.stack || 'No stack trace'}`
        );
    } catch (err) {
        console.error('Failed to send error notification:', err);
    }
}

// Add this near your other notification functions in server.js
async function notifyChatUpload(userInfo, chatInfo) {
    try {
        let message = `📤 New chat upload:\n`;
        
        if (userInfo) {
            message += `👤 User: ${userInfo.name || 'Anonymous'}\n`;
            message += `📧 Email: ${userInfo.email || 'Not provided'}\n`;
            message += `🆔 User ID: ${userInfo.id || 'N/A'}\n`;
        } else {
            message += `👤 User: Anonymous\n`;
        }
        
        message += `📄 Chat participants: ${chatInfo.participants.join(', ')}\n`;
        message += `📝 Preview:\n${chatInfo.preview}\n`;
        message += `👥 Group chat: ${chatInfo.isGroup ? 'Yes' : 'No'}`;

        await bot.sendMessage(TELEGRAM_CHAT_ID, message);
    } catch (err) {
        console.error('Telegram notification failed:', err);
    }
}

async function notifyAnalysis(userId, analysisType, creditsUsed = 0) {
    try {
        let message = `📊 New analysis completed:\n`;
        message += `🔍 Type: ${analysisType}\n`;
        
        if (userId !== 'anonymous') {
            // Get user details from Firestore if logged in
            const userDoc = await db.collection('users').doc(userId).get();
            if (userDoc.exists) {
                const user = userDoc.data();
                message += `👤 User: ${user.name || 'Unknown'}\n`;
                message += `📧 Email: ${user.email || 'Unknown'}\n`;
                message += `🆔 User ID: ${userId}\n`;
            }
        } else {
            message += `👤 User: Anonymous\n`;
        }
        
        message += `🪙 Credits used: ${creditsUsed}`;
        
        await bot.sendMessage(TELEGRAM_CHAT_ID, message);
    } catch (err) {
        console.error('Telegram notification failed:', err);
    }
}

// POST /api/save-consent
// POST /api/save-consent
app.post('/api/save-consent', async (req, res) => {
    try {
        const { userId, consented } = req.body;
        if (!userId || typeof consented !== 'boolean') {
            console.error('Invalid consent request:', req.body);
            return res.status(400).json({ error: 'Invalid request' });
        }

        // Verify user exists first
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
            console.error('User not found for consent:', userId);
            return res.status(404).json({ error: 'User not found' });
        }

        await userRef.set({
            aiConsent: consented,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        return res.json({ success: true });
    } catch (err) {
        console.error('Error saving consent:', err);
        await notifyError(err, { 
            endpoint: '/api/save-consent', 
            body: req.body 
        }, req.body?.userId);
        return res.status(500).json({ error: 'Failed to save consent' });
    }
});

// DELETE /api/delete-analysis/:userId/:analysisId
app.delete('/api/delete-analysis/:userId/:analysisId', async (req, res) => {
  try {
    const { userId, analysisId } = req.params;
    await db
      .collection('users')
      .doc(userId)
      .collection('analyses')
      .doc(analysisId)
      .delete();
    res.json({ success: true });
  } catch (e) {
    console.error('Delete failed:', e);
    res.status(500).json({ error: 'Failed to delete analysis' });
  }
});


// PATCH /api/update-analysis/:userId/:analysisId
app.patch('/api/update-analysis/:userId/:analysisId', async (req, res) => {
  try {
    const { userId, analysisId } = req.params;
    const { html, isBasic } = req.body; // Add isBasic parameter
    
    const update = { 
      'analysisData.html': html, 
      updatedAt: admin.firestore.FieldValue.serverTimestamp() 
    };
    
    // If it's being marked as non-basic (AI), remove any expiration
    if (isBasic === false) {
      update.expiresAt = null;
    }
    
    await db
      .collection('users')
      .doc(userId)
      .collection('analyses')
      .doc(analysisId)
      .update(update);
      
    res.json({ success: true });
  } catch (e) {
    console.error('Update failed:', e);
    res.status(500).json({ error: 'Failed to update analysis' });
  }
});

// Add this endpoint before other routes
app.get('/api/verify-auth/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const doc = await db.collection('users').doc(userId).get();
    
    if (!doc.exists) {
      return res.status(404).json({ authenticated: false });
    }
    
    const userData = doc.data();
    // Add any additional verification checks here
    return res.json({ authenticated: true });
  } catch (err) {
    console.error('Auth verification failed:', err);
    return res.status(500).json({ authenticated: false });
  }
});


app.get('/api/get-analyses/:userId', async (req, res) => {
  try {
    const snaps = await db
      .collection('users')
      .doc(req.params.userId)
      .collection('analyses')
      .orderBy('createdAt', 'desc')
      .get();
    const list = snaps.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        analysisData: data.analysisData,
        createdAt: data.createdAt.toDate().toISOString(),
        // include expiresAt if set, else null
        expiresAt: data.expiresAt
          ? data.expiresAt.toDate().toISOString()
          : null,
      };
    });
    res.json(list);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not list analyses' });
  }
});

// GET /api/get-analysis/:userId/:analysisId
app.get('/api/get-analysis/:userId/:analysisId', async (req, res) => {
  try {
    const { userId, analysisId } = req.params;
    const doc = await db
      .collection('users')
      .doc(userId)
      .collection('analyses')
      .doc(analysisId)
      .get();
    if (!doc.exists) return res.status(404).json({ error: 'Not found' });
    return res.json({ id: doc.id, analysisData: doc.data().analysisData });
  } catch (e) {
    console.error('Fetch failed:', e);
    res.status(500).json({ error: 'Server error' });
  }
});




// API Routes
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const modelConfig = {
    model: "gemini-2.0-flash",
    generationConfig: {
      temperature: 0.1,
      topP: 1,
      topK: 32,
      maxOutputTokens: 8192,
      seed: 42,
    },
};


// In server.js, modify the analyze endpoint to ensure notifications are sent:
app.post('/api/analyze', async (req, res) => {
    try {
        const { chatText, userId, participants, isGroupChat, preview } = req.body;
        if (!chatText) return res.status(400).json({ error: 'No chat text provided' });
        
        const model = genAI.getGenerativeModel(modelConfig);
        const result = await model.generateContent(chatText);
        const response = await result.response;
        const text = response.text();
        
        try {
            const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            
            // Send analysis completion notification
            await notifyAnalysisComplete(userId || null, "AI Analysis", participants, isGroupChat, preview);
            
            return res.json(parsed);
        } catch (e) {
            console.error("❌ Failed to parse AI JSON:", text);
            await notifyError(e, { endpoint: '/api/analyze', error: "AI response format error" }, userId);
            return res.status(500).json({ error: "AI response format error", raw: text });
        }
    } catch (error) {
        console.error("AI error:", error);
        await notifyError(error, { endpoint: '/api/analyze' }, userId);
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
    const { sub: id, name, email, picture } = payload;

    // Check if user is new (first time logging in)
    const userRef = db.collection('users').doc(id);
    const userDoc = await userRef.get();
    const isNewUser = !userDoc.exists;

    // Save or update user data with ALL fields
    await userRef.set({
      name,
      email, // <-- This was missing in your current implementation
      picture,
      lastLogin: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: isNewUser 
        ? admin.firestore.FieldValue.serverTimestamp() 
        : userDoc.data().createdAt || admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      credits: isNewUser ? 0 : userDoc.data().credits || 0 // Initialize credits if new user
    }, { merge: true });
    // Notify Telegram about the new login
    // Add this right before the res.json() at the end of the try block:
    await notifyLogin({
        id,
        name,
        email,
        picture
    });
    res.json({
      success: true,
      user: { id, name, email, picture }
    });
    
  } catch (error) {
    console.error('Token verification failed:', error);
    res.status(400).json({ success: false, error: 'Invalid token' });
  }
});


app.post('/api/log-analysis', async (req, res) => {
    try {
        const { userId, analysisType } = req.body;
        await notifyAnalysis(userId, analysisType, analysisType === 'AI' ? 1 : 0);
        res.json({ success: true });
    } catch (err) {
        console.error('Analysis logging failed:', err);
        res.status(500).json({ error: 'Logging failed' });
    }
});

// Add this new endpoint
app.get('/api/credits-listener/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const userRef = db.collection('users').doc(userId);
        
        // Set up listener
        const unsubscribe = userRef.onSnapshot((doc) => {
            if (doc.exists) {
                const credits = doc.data().credits || 0;
                // This would need to be handled via WebSockets or similar
                // In a real implementation, you'd use Socket.io or similar
                res.write(`data: ${JSON.stringify({credits})}\n\n`);
            }
        });

        // Close connection when client disconnects
        req.on('close', () => {
            unsubscribe();
        });

        // Set headers for SSE (Server-Sent Events)
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
    } catch (err) {
        console.error('Credits listener error:', err);
        res.status(500).json({ error: 'Listener failed' });
    }
});


app.get('/api/user-credits/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const userRef = db.collection('users').doc(userId);
    const snap = await userRef.get();
    
    // Don't create user if doesn't exist
    if (!snap.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const data = snap.data();
    return res.json({ credits: data.credits || 0 });
  } catch (err) {
    console.error('Error fetching user credits:', err);
    return res.status(500).json({ error: 'Could not fetch credits' });
  }
});


app.post('/api/update-credits', requireAuth, async (req, res) => {

  try {
    const { userId, amount } = req.body;
    if (!userId || typeof amount !== 'number') {
      console.error('❌ Bad body:', req.body);
      return res.status(400).json({ error: 'Missing or invalid userId/amount' });
    }

    console.log(`🛠 POST /api/update-credits`, req.body);

    const userRef = db.collection('users').doc(userId);
    const doc = await userRef.get();

    if (!doc.exists) {
      // First-time user
      await userRef.set({
        credits: amount,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      // Returning user → increment credits
      await userRef.update({
        credits: admin.firestore.FieldValue.increment(amount),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    const updatedDoc = await userRef.get();
    const credits = updatedDoc.data().credits || 0;
    return res.json({ success: true, credits });

  } catch (err) {
    console.error('❌ POST /api/update-credits failed:', err);
    return res.status(500).json({ error: 'Failed to update credits' });
  }
});




app.get('/analyze', (req, res) => {
  res.sendFile(path.join(frontendPath, 'analyze.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://192.168.1.225:${PORT} or http://localhost:3000`);
});
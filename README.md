# WhatStatistic - WhatsApp Chat Analyzer

## Overview
WhatStatistic is a web application built in 2025 designed to analyze and extract insights from WhatsApp chat exports. It uses advanced AI (Google Gemini) to summarize conversations, detect the tone of the chat, and provide detailed analytics for both personal and group chats. 

## Background
This was a major project in 2025. Beyond just development, I personally handled the marketing strategy across Instagram and TikTok, consistently posting short-form content. Some of these videos went viral, successfully driving real traffic and generating actual revenue for the product.

## Features
- **AI Analysis**: Get intelligent summaries and insights from any chat using Gemini AI.
- **Deep Analytics**: View word counts, participant activity, and other metadata.
- **Credit System**: Integrated Stripe payments for purchasing analysis credits.
- **Authentication**: Secure user login and management via Google OAuth and Firebase.
- **Real-time Notifications**: Backend integration with a Telegram bot to monitor user activity, file uploads, and errors.

## Tech Stack
- **Frontend**: HTML5, Vanilla JS, CSS3
- **Backend**: Node.js, Express.js
- **Database & Auth**: Firebase Admin SDK (Firestore)
- **AI Integration**: Google Generative AI (Gemini 2.0 Flash)
- **Payments**: Stripe Checkout

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Create a `.env` file in the root directory with the following keys:
   ```env
   STRIPE_SECRET_KEY=your_stripe_secret
   STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
   FRONTEND_URL=http://localhost:3000
   GEMINI_API_KEY=your_gemini_api_key
   GOOGLE_CLIENT_ID=your_google_client_id
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   TELEGRAM_CHAT_ID=your_telegram_chat_id
   PORT=3000
   ```

3. **Firebase Setup**
   Place your Firebase service account credentials in `serviceAccountKey.json` at the root of the project.

4. **Start the Server**
   ```bash
   node server.js
   ```
   The server will start on port 3000 by default.

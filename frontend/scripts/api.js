// Frontend API service for all server communications

/**
 * Saves analysis HTML to the database
 * @param {string} userId - User ID from auth
 * @param {object} data - Analysis data {html, metadata}
 * @returns {Promise} Resolves with saved analysis data
 */
export async function saveAnalysisHTML(userId, data) {
  try {
      const res = await fetch('/api/save-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, ...data })
      });
      
      if (!res.ok) {
          throw new Error(await res.text());
      }
      
      return await res.json();
  } catch (error) {
      console.error('Failed to save analysis:', error);
      throw error;
  }
}

/**
* Gets all saved analyses for a user
* @param {string} userId - User ID from auth
* @returns {Promise} Resolves with array of analyses
*/
export async function getAnalyses(userId) {
  try {
      const res = await fetch(`/api/get-analyses/${userId}`);
      if (!res.ok) throw new Error('Failed to fetch analyses');
      return await res.json();
  } catch (error) {
      console.error('Failed to get analyses:', error);
      throw error;
  }
}

/**
* Gets a specific analysis by ID
* @param {string} chatId - Analysis ID
* @returns {Promise} Resolves with analysis data
*/
export async function getAnalysisHTML(chatId) {
  try {
      const res = await fetch(`/api/get-analysis/${chatId}`);
      if (!res.ok) throw new Error('Failed to fetch analysis');
      return await res.json();
  } catch (error) {
      console.error('Failed to get analysis:', error);
      throw error;
  }
}

/**
* Deletes an analysis
* @param {string} chatId - Analysis ID to delete
* @returns {Promise} Resolves when deletion is complete
*/
export async function deleteAnalysis(chatId) {
  try {
      const res = await fetch(`/api/delete-analysis/${chatId}`, {
          method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete analysis');
      return await res.json();
  } catch (error) {
      console.error('Failed to delete analysis:', error);
      throw error;
  }
}

/**
* Deducts credits from user account
* @param {string} userId - User ID from auth
* @param {number} amount - Amount to deduct (positive number)
* @returns {Promise} Resolves with new credit balance
*/
export async function deductCredit(userId, amount) {
  try {
      const res = await fetch('/api/update-credits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, amount: -Math.abs(amount) })
      });
      
      if (!res.ok) {
          throw new Error(await res.text());
      }
      
      const result = await res.json();
      localStorage.setItem('userCredits', result.credits);
      return result;
  } catch (error) {
      console.error('Failed to deduct credits:', error);
      throw error;
  }
}

/**
* Gets user's current credit balance
* @param {string} userId - User ID from auth
* @returns {Promise} Resolves with credit balance
*/
export async function getCredits(userId) {
  try {
      const res = await fetch(`/api/user-credits/${userId}`);
      if (!res.ok) throw new Error('Failed to fetch credits');
      const result = await res.json();
      localStorage.setItem('userCredits', result.credits);
      return result.credits;
  } catch (error) {
      console.error('Failed to get credits:', error);
      throw error;
  }
}
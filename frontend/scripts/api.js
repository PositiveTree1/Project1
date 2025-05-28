// Frontend API service for all server communications

/**
 * Saves analysis HTML to the database
 * @param {string} userId - User ID from auth
 * @param {object} data - Analysis data {html, metadata}
 * @returns {Promise} Resolves with saved analysis data
 */

/**
* Gets all saved analyses for a user
* @param {string} userId - User ID from auth
* @returns {Promise} Resolves with array of analyses
*/


/**
* Gets a specific analysis by ID
* @param {string} chatId - Analysis ID
* @returns {Promise} Resolves with analysis data
*/

/**
* Deletes an analysis
* @param {string} chatId - Analysis ID to delete
* @returns {Promise} Resolves when deletion is complete
*/
// DELETE /api/delete-analysis/:userId/:analysisId
export async function deleteAnalysis(analysisId) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (!user.sub) throw new Error('Not signed in');
  const res = await fetch(`/api/delete-analysis/${user.sub}/${analysisId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete analysis');
  return res.json();
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

// In api.js - add these new functions

/**
 * Saves raw analysis data to the database
 * @param {string} userId - User ID from auth
 * @param {object} data - Raw analysis data
 * @returns {Promise} Resolves with saved analysis data
 */

  /**
   * Gets raw analysis data by ID
   * @param {string} chatId - Analysis ID
   * @returns {Promise} Resolves with raw analysis data
   */
  export async function getAnalysisData(chatId) {
    try {
        const res = await fetch(`/api/get-analysis-data/${chatId}`);
        if (!res.ok) throw new Error('Failed to fetch analysis data');
        return await res.json();
    } catch (error) {
        console.error('Failed to get analysis data:', error);
        throw error;
    }
  }
export async function saveAnalysisHTML(userId, { html, metadata }, basic) {
    const res = await fetch('/api/save-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId,
            analysisData: { html, metadata },
            basic // <-- tell the server if this is a “basic” chat
        })
    });
    if (!res.ok) throw new Error('Failed to save analysis');
    return res.json();
}


  // GET /api/get-analyses/:userId
export async function getAnalyses(userId) {
    const res = await fetch(`/api/get-analyses/${userId}`);
    if (!res.ok) throw new Error('Failed to fetch analyses');
    return res.json(); // → [ { id, analysisData:{html,metadata}, createdAt }… ]
  }
  
  
  export async function getAnalysisHTML(analysisId) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.sub) throw new Error('Not signed in');
    const res = await fetch(`/api/get-analysis/${user.sub}/${analysisId}`);
    if (!res.ok) throw new Error('Failed to fetch analysis HTML');
    return res.json();  // { id, analysisData:{ html, metadata } }
  }


// api.js
export async function updateAnalysisHTML(userId, analysisId, html, isBasic = false) {
  const res = await fetch(`/api/update-analysis/${userId}/${analysisId}`, {
    method: 'PATCH',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ html, isBasic }) // Add isBasic parameter
  });
  if (!res.ok) throw new Error('Update failed');
  return res.json();
}

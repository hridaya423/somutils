const api = typeof browser !== 'undefined' ? browser : chrome;

const executeScript = async (options) => {
  if (api.scripting && api.scripting.executeScript) {
    return await api.scripting.executeScript(options);
  } else if (api.tabs && api.tabs.executeScript) {
    const tabId = options.target.tabId;
    const func = options.func;
    const args = options.args || [];
    
    return await api.tabs.executeScript(tabId, {
      code: `(${func.toString()})(${args.map(arg => JSON.stringify(arg)).join(', ')})`
    });
  } else {
    throw new Error('Script execution not supported');
  }
};

api.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('summer.hackclub.com')) {
    executeScript({
      target: { tabId: tabId },
      func: () => {
        const savedTheme = localStorage.getItem('somTheme');
        const savedCustomColors = localStorage.getItem('somCustomColors');
        
        if (savedTheme) {
          window.postMessage({
            type: 'APPLYTHEME',
            theme: savedTheme,
            customColors: savedCustomColors ? JSON.parse(savedCustomColors) : null
          }, '*');
        }
      }
    }).catch(err => {
    });
  }
});

api.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  if (request.action === 'fetchUserRank') {
    fetchUserRank(request.username, request.avatarUrl)
      .then(rank => {
        sendResponse({ success: true, rank: rank });
      })
      .catch(error => {
        console.error('SOM Utils Background: Error fetching rank:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (request.action === 'fetchShellsHistory') {
    fetchShellsHistory(request.username, request.avatarUrl)
      .then(data => {
        sendResponse({ success: true, data: data });
      })
      .catch(error => {
        console.error('SOM Utils Background: Error fetching shells history:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (request.action === 'fetchEconomyData') {
    fetchEconomyData()
      .then(data => {
        sendResponse({ success: true, data: data });
      })
      .catch(error => {
        console.error('SOM Utils Background: Error fetching economy data:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (request.action === 'fetchUserNetWorth') {
    fetchUserNetWorth(request.username, request.avatarUrl)
      .then(data => {
        sendResponse({ success: true, data: data });
      })
      .catch(error => {
        console.error('SOM Utils Background: Error fetching user net worth:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (request.action === 'fetchHackatimeStats') {
    fetchHackatimeStats(request.slackId)
      .then(data => {
        sendResponse({ success: true, data: data });
      })
      .catch(error => {
        console.error('SOM Utils Background: Error fetching Hackatime stats:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (request.action === 'fetchShopOrders') {
    fetchShopOrders(request.userId, request.csrfToken)
      .then(data => {
        sendResponse({ success: true, data: data });
      })
      .catch(error => {
        console.error('SOM Utils Background: Error fetching shop orders:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (request.action === 'executeInPageContext') {
    executeShopOrdersInPageContext(sender.tab.id, request.userId, request.csrfToken)
      .then(data => {
        sendResponse({ success: true, data: data });
      })
      .catch(error => {
        console.error('SOM Utils Background: Error executing in page context:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
});

function findUserByAvatarAndName(users, username, avatarUrl) {
  if (!users || !Array.isArray(users) || users.length === 0) {
    return null;
  }

  if (avatarUrl) {
    for (const user of users) {
      if (user.username === username && user.image === avatarUrl) {
        return user;
      }
    }

    for (const user of users) {
      if (user.image === avatarUrl) {
        return user;
      }
    }
  }

  for (const user of users) {
    if (user.username === username) {
      return user;
    }
  }

  return null;
}

async function fetchUserRank(username, avatarUrl = null) {
  if (!username) {
    throw new Error('Username is required');
  }
  
  try {
    const response = await fetch(`https://lb.summer.hackclub.com/api/search?search=${encodeURIComponent(username)}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if (data.users && data.users.length > 0) {
      const user = findUserByAvatarAndName(data.users, username, avatarUrl);
      if (user) {
        return user.rank;
      }
    }
    
    throw new Error('User not found in leaderboard');
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}

async function fetchShellsHistory(username, avatarUrl = null) {

  if (!username) {
    throw new Error('Username is required');
  }
  
  try {
    const response = await fetch(`https://lb.summer.hackclub.com/api/search?search=${encodeURIComponent(username)}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();

    if (!data.users || !Array.isArray(data.users) || data.users.length === 0) {
      throw new Error('User not found in leaderboard');
    }
    
    const user = findUserByAvatarAndName(data.users, username, avatarUrl);
    if (!user) {
      throw new Error('User not found in leaderboard');
    }
    
    const shellHistory = [];
    let cumulativeShells = 0;
    
    if (user.payouts && Array.isArray(user.payouts)) {
      const payoutTypes = user.payouts.map(p => p.type);
      const typeCount = payoutTypes.reduce((acc, type) => {
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});
      
      const sortedPayouts = user.payouts
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      

      sortedPayouts.forEach(payout => {
        const amount = parseFloat(payout.amount) || 0;
        cumulativeShells += amount;
        shellHistory.push({
          timestamp: new Date(payout.created_at).getTime(),
          date: new Date(payout.created_at),
          shells: cumulativeShells,
          amount: amount,
          type: payout.type
        });
      });
    }
    
    return {
      shellHistory: shellHistory,
      totalShells: cumulativeShells,
      totalEarned: cumulativeShells
    };
    
  } catch (error) {
    console.error('Shells history fetch error:', error);
    throw error;
  }
}

async function fetchUserNetWorth(username, avatarUrl = null) {
  if (!username) {
    throw new Error('Username is required');
  }
  
  try {
    const response = await fetch(`https://lb.summer.hackclub.com/api/search?search=${encodeURIComponent(username)}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.users || !Array.isArray(data.users) || data.users.length === 0) {
      throw new Error('User not found in leaderboard');
    }
    
    const user = findUserByAvatarAndName(data.users, username, avatarUrl);
    if (!user) {
      throw new Error('User not found in leaderboard');
    }
    
    
    let totalEarned = 0;
    let totalSpent = 0;
    let shopOrderCount = 0;
    
    if (user.payouts && Array.isArray(user.payouts)) {
      user.payouts.forEach(payout => {
        const amount = parseFloat(payout.amount) || 0;
        
        if (payout.type === 'ShipEvent') {
          totalEarned += Math.abs(amount);
        } else if (payout.type === 'ShopOrder') {
          totalSpent += Math.abs(amount);
          shopOrderCount++;
        }
      });
    }
    
    const netWorth = totalEarned - totalSpent;
    
    return {
      totalEarned: totalEarned,
      totalSpent: totalSpent,
      shopOrderCount: shopOrderCount,
      netWorth: Math.max(0, netWorth)
    };
    
  } catch (error) {
    console.error('User net worth fetch error:', error);
    throw error;
  }
}

async function fetchEconomyData() {
  try {
    
    const response = await fetch('https://explorpheus.hackclub.com/leaderboard');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!Array.isArray(data)) {
      throw new Error('Invalid economy data format - expected array');
    }
    
    console.log('Processing', data.length, 'users for economy calculation');
    
    let totalShellsEarned = 0;
    let totalShellsSpent = 0;
    let totalUsers = data.length;
    
    data.forEach(user => {
      if (user.payouts && Array.isArray(user.payouts)) {
        user.payouts.forEach(payout => {
          const amount = parseFloat(payout.amount) || 0;
          
          if (payout.type === 'ShipEvent') {
            totalShellsEarned += Math.abs(amount); 
          } else if (payout.type === 'ShopOrder') {
            totalShellsSpent += Math.abs(amount); 
          }
        });
      }
    });
    
    const totalEconomyShells = totalShellsEarned - totalShellsSpent;
    
    console.log('Economy calculation complete:', {
      totalShellsEarned,
      totalShellsSpent,
      totalEconomyShells,
      totalUsers
    });
    
    return {
      totalEconomyShells: Math.max(0, totalEconomyShells),
      totalUsers: totalUsers,
      shellsEarned: totalShellsEarned,
      shellsSpent: totalShellsSpent
    };
    
  } catch (error) {
    console.error('Economy fetch error:', error);
    throw error;
  }
}

async function fetchHackatimeStats(slackId) {
  if (!slackId) {
    throw new Error('Slack ID is required');
  }
  
  try {
    const response = await fetch(`httpshackatime.hackclub.com/api/v1/users/${encodeURIComponent(slackId)}/stats?features=projects`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Hackatime fetch error:', error);
    throw error;
  }
}

async function fetchShopOrders(userId, csrfToken) {
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  if (!csrfToken) {
    throw new Error('CSRF token is required');
  }
  
  try {
    const runId = crypto.randomUUID();
    const body = new URLSearchParams({
      statement: "SELECT * FROM shop_orders WHERE user_id = {user_id}",
      query_id: "45",
      data_source: "main",
      "variables[user_id]": userId,
      run_id: runId
    });

    const response = await fetch("https://summer.hackclub.com/admin/blazer/queries/run", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Accept": "text/html, */*; q=0.01",
        "X-CSRF-Token": csrfToken,
        "X-Requested-With": "XMLHttpRequest",
        "Referer": `https://summer.hackclub.com/admin/blazer/queries/45-get-shop-orders?user_id=${userId}`
      },
      body: body.toString()
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseText = await response.text();
    
    return parseShopOrdersFromHTML(responseText);
  } catch (error) {
    console.error('Shop orders fetch error:', error);
    throw error;
  }
}

function parseShopOrdersFromHTML(html) {
  const jsonMatch = html.match(/data-results="([^"]+)"/);
  if (jsonMatch) {
    try {
      const jsonData = JSON.parse(jsonMatch[1].replace(/&quot;/g, '"'));
      return jsonData;
    } catch (e) {
      console.error('Failed to parse JSON from HTML:', e);
    }
  }
  
  return [];
}

async function executeShopOrdersInPageContext(tabId, userId, csrfToken) {
  try {
    const results = await executeScript({
      target: { tabId: tabId },
      func: fetchShopOrdersInPage,
      args: [userId, csrfToken]
    });
    
    if (results && results[0] && results[0].result) {
      return results[0].result;
    } else {
      throw new Error('No results returned from page execution');
    }
  } catch (error) {
    console.error('Execute script error:', error);
    throw error;
  }
}

async function fetchShopOrdersInPage(userId, csrfToken) {
  function parseShopOrdersFromHTML(html) {
    const jsonMatch = html.match(/data-results="([^"]+)"/);
    if (jsonMatch) {
      try {
        const jsonData = JSON.parse(jsonMatch[1].replace(/&quot;/g, '"'));
        return jsonData;
      } catch (e) {
        console.error('Failed to parse JSON from HTML:', e);
      }
    }
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const table = doc.querySelector('table');
    
    if (table) {
      const rows = table.querySelectorAll('tbody tr');
      const orders = [];
      
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          orders.push({
            id: cells[0]?.textContent?.trim(),
            quantity: cells[1]?.textContent?.trim(),
            aasm_state: cells[2]?.textContent?.trim(),
            created_at: cells[3]?.textContent?.trim(),
            updated_at: cells[4]?.textContent?.trim(),
            rejection_reason: cells[5]?.textContent?.trim(),
            rejected_at: cells[6]?.textContent?.trim(),
            fulfilled_at: cells[7]?.textContent?.trim(),
            awaiting_periodical_fulfillment_at: cells[8]?.textContent?.trim(),
            on_hold_at: cells[9]?.textContent?.trim(),
            internal_notes: cells[10]?.textContent?.trim()
          });
        }
      });
      return orders;
    }
    
    return [];
  }

  try {
    const runId = crypto.randomUUID();
    const body = new URLSearchParams({
      statement: "SELECT id, quantity, aasm_state, created_at, updated_at, rejection_reason, rejected_at, fulfilled_at, awaiting_periodical_fulfillment_at, on_hold_at, internal_notes FROM shop_orders WHERE user_id = {user_id} ORDER BY created_at DESC",
      query_id: "45",
      data_source: "main",
      "variables[user_id]": userId,
      run_id: runId
    });

    const response = await fetch("/admin/blazer/queries/run", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Accept": "text/html, */*; q=0.01",
        "X-CSRF-Token": csrfToken,
        "X-Requested-With": "XMLHttpRequest"
      },
      body: body.toString()
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseText = await response.text();
    
    return parseShopOrdersFromHTML(responseText);
  } catch (error) {
    throw error;
  }
}

function parseShopOrdersFromHTML(html) {
  const jsonMatch = html.match(/data-results="([^"]+)"/);
  if (jsonMatch) {
    try {
      const jsonData = JSON.parse(jsonMatch[1].replace(/&quot;/g, '"'));
      return jsonData;
    } catch (e) {
    }
  }
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  
  if (table) {
    const rows = table.querySelectorAll('tbody tr');
    const orders = [];
    
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 2) {
        orders.push({
          id: cells[0]?.textContent?.trim(),
          quantity: cells[1]?.textContent?.trim(),
          aasm_state: cells[2]?.textContent?.trim(),
          created_at: cells[3]?.textContent?.trim(),
          updated_at: cells[4]?.textContent?.trim(),
          rejection_reason: cells[5]?.textContent?.trim(),
          rejected_at: cells[6]?.textContent?.trim(),
          fulfilled_at: cells[7]?.textContent?.trim(),
          awaiting_periodical_fulfillment_at: cells[8]?.textContent?.trim(),
          on_hold_at: cells[9]?.textContent?.trim(),
          internal_notes: cells[10]?.textContent?.trim()
        });
      }
    });
    
    return orders;
  }
  
  return [];
}


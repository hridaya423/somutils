chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  if (request.action === 'fetchUserRank') {
    fetchUserRank(request.username)
      .then(rank => {
        sendResponse({ success: true, rank: rank });
      })
      .catch(error => {
        console.error('SOM Utils Background: Error fetching rank:', error);
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
    fetchUserNetWorth(request.username)
      .then(data => {
        sendResponse({ success: true, data: data });
      })
      .catch(error => {
        console.error('SOM Utils Background: Error fetching user net worth:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
});

async function fetchUserRank(username) {
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
      const user = data.users[0];
      console.log('Found user rank:', user.rank);
      return user.rank;
    }
    
    throw new Error('User not found in leaderboard');
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}

async function fetchUserNetWorth(username) {
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
    
    const user = data.users[0];
    
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


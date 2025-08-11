window.somUtilsProjectionMode = true;

class VoteEstimationService {
  static BASE_RATING = 1100;
  
  static estimateVotes(shells, hours) {
  if (!shells || !hours || shells <= 0 || hours <= 0) {
      return {
        estimatedVotes: 0,
        confidence: 'low',
        details: 'Insufficient data'
      };
    }
    
    try {
      const baseShells = hours * 1
      const multiplier = shells / baseShells;
      const percentile = this.getPercentileFromMultiplier(multiplier);
      const normalizedRating = this.reverseMultiplier(multiplier);
      const eloRating = this.denormalizeRating(normalizedRating);
      const voteCount = this.estimateVoteCount(multiplier, percentile);
      
      const confidence = this.calculateConfidence(multiplier, voteCount);
      
      const topPercentage = (100 - percentile * 100).toFixed(1);
      
      
      return {
        estimatedVotes: Math.max(0, Math.round(voteCount)),
        confidence: confidence,
        details: {
          baseShells: baseShells.toFixed(1),
          multiplier: multiplier.toFixed(2),
          eloRating: Math.round(eloRating),
          normalizedRating: normalizedRating.toFixed(3),
          percentile: (percentile * 100).toFixed(1) + '%',
          topPercentage: 'Top ' + topPercentage + '%'
        }
      };
    } catch (error) {
      console.warn('SOM Utils: Vote estimation error:', error);
      return {
        estimatedVotes: 0,
        confidence: 'low',
        details: 'Calculation error'
      };
    }
  }
  
  static calculateMultiplier(x) {
    const t = 0.5;
    const a = 10.0;
    const n = 1.0;
    const m = 30.0;
    
    const exp = Math.log((a - n) / (m - n)) / Math.log(t);
    const term1 = 2.0 * x - 1.0;
    const term2 = Math.sqrt(2.0 * (1.0 - (term1 * term1) / 2.0));
    const normalized = (term1 * term2 + 1.0) / 2.0;
    
    return n + Math.pow(normalized, exp) * (m - n);
  }
  
  static getPercentileFromMultiplier(multiplier) {
    const clampedMultiplier = Math.max(1.0, Math.min(30.0, multiplier));
    
    let low = 0.0;
    let high = 1.0;
    let mid, calculatedMultiplier;
    
    for (let i = 0; i < 50; i++) {
      mid = (low + high) / 2.0;
      calculatedMultiplier = this.calculateMultiplier(mid);
      
      if (Math.abs(calculatedMultiplier - clampedMultiplier) < 0.001) {
        break;
      }
      
      if (calculatedMultiplier < clampedMultiplier) {
        low = mid;
      } else {
        high = mid;
      }
    }
    
    return mid;
  }
  
  static reverseMultiplier(multiplier) {
    const percentile = this.getPercentileFromMultiplier(multiplier);
    return Math.max(-1, Math.min(1, (percentile - 0.5) * 2));
  }
  
  
  static denormalizeRating(normalizedRating) {
    const RATING_RANGE = 300;
    return this.BASE_RATING + (normalizedRating * RATING_RANGE);
  }
  
  
  static estimateVoteCount(multiplier, percentile) {
    const adjustedPercentile = 0.1 + (percentile * 0.8);
    
    const votesWon = Math.round(adjustedPercentile * 18);
    
    return Math.max(1, Math.min(17, votesWon));
  }
  
  
  static calculateConfidence(multiplier, voteCount) {
    if (multiplier >= 7 && multiplier <= 15) {
      return 'high';
    }
    
    if (multiplier >= 4 && multiplier <= 20) {
      return 'medium';
    }
    return 'low';
  }
}

function parseTimeString(timeStr) {
  const hourMatch = timeStr.match(/(\d+)h/);
  const minuteMatch = timeStr.match(/(\d+)m/);
  
  const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
  const minutes = minuteMatch ? parseInt(minuteMatch[1]) : 0;
  
  return hours + (minutes / 60);
}

function parseShellsString(shellsText) {
  if (!shellsText) {
    return 0;
  }
  
    if (shellsText.includes("Project is awaiting ship certification!")) {
      return -1;
    }
  
  if (shellsText.includes("To get shells, ship this project!")) {
    return 0;
  }
  
  const totalMatch = shellsText.match(/(\d+(?:\.\d+)?)\s*shells\s+total/);
  if (totalMatch) {
    return parseFloat(totalMatch[1]);
  }
  
  const match = shellsText.match(/(\d+(?:\.\d+)?)\s*shells/);
  return match ? parseFloat(match[1]) : 0;
}

function calculateShellsPerHour(shells, hours) {
  if (hours === 0) return 0;
  return shells / hours;
}

function saveUserEfficiency(shells, hours) {
  console.log('SOM Utils: Saving efficiency data - Shells:', shells, 'Hours:', hours);
  
  let data;
  try {
    data = JSON.parse(localStorage.getItem('som-utils-efficiency') || '{"projects": []}');
  } catch (error) {
    console.error('SOM Utils: Error parsing existing efficiency data:', error);
    data = {"projects": []};
  }
  
  const existingProject = data.projects.find(project => 
    Math.abs(project.shells - shells) < 0.001 && Math.abs(project.hours - hours) < 0.001
  );
  
  if (existingProject) {
    return;
  }
  
  data.projects.push({ shells, hours, timestamp: Date.now() });
  
  if (data.projects.length > 20) {
    data.projects = data.projects.slice(-20);
  }
  
  localStorage.setItem('som-utils-efficiency', JSON.stringify(data));
}

function getUserAverageEfficiency() {
  let data;
  try {
    data = JSON.parse(localStorage.getItem('som-utils-efficiency') || '{"projects": []}');
  } catch (error) {
    localStorage.setItem('som-utils-efficiency', '{"projects": []}');
    return null;
  }
  
  if (!data.projects || data.projects.length === 0) return null;
  
  let totalShells = 0;
  let totalHours = 0;
  
  data.projects.forEach(project => {
    totalShells += project.shells;
    totalHours += project.hours;
  });
  
  return totalHours > 0 ? calculateShellsPerHour(totalShells, totalHours) : null;
}

function getCurrentUserShells(projected = false) {
  const shellImages = document.querySelectorAll('picture.inline-block.w-4.h-4.flex-shrink-0 img[src*="shell"]');
  
  let currentShells = 0;
  for (const img of shellImages) {
    const picture = img.closest('picture');
    if (picture) {
      const fontBoldSpan = picture.parentElement?.querySelector('span.font-extrabold');
      if (fontBoldSpan) {
        const shellSpan = fontBoldSpan.querySelector('span.ml-1');
        if (shellSpan) {
          const shellText = shellSpan.textContent.trim();
          const shellMatch = shellText.match(/(\d+(?:\.\d+)?)/);
          if (shellMatch) {
            currentShells = parseFloat(shellMatch[1]);
            break;
          }
        }
      }
    }
  }
  
  if (currentShells > 0) {
    localStorage.setItem('som-utils-current-shells', currentShells.toString());
  } else {
    const storedShells = localStorage.getItem('som-utils-current-shells');
    if (storedShells) {
      currentShells = parseFloat(storedShells);
    }
  }
  
  if (!projected) {
    return currentShells;
  }
  
  let efficiency = getUserAverageEfficiency();
  if (!efficiency) {
    efficiency = 10;
  }
  
  const totalHoursData = getTotalHoursData();
  if (!totalHoursData) {
    return currentShells;
  }
  
  let efficiencyData;
  try {
    efficiencyData = JSON.parse(localStorage.getItem('som-utils-efficiency') || '{"projects": []}');
  } catch (error) {
    console.error('SOM Utils: Error parsing efficiency data for projected progress:', error);
    return currentShells;
  }
  
  let shippedHours = 0;
  efficiencyData.projects.forEach(project => {
    shippedHours += project.hours;
  });

  const unshippedHours = Math.max(0, totalHoursData.totalHours - shippedHours);
  const estimatedShellsFromUnshipped = unshippedHours * efficiency;
  
  const estTotalShells = currentShells + estimatedShellsFromUnshipped;
  
  return estTotalShells;
}

function getCurrentUsername() {
  const shellImages = document.querySelectorAll('picture.inline-block.w-4.h-4.flex-shrink-0 img[src*="shell"]');

  for (const img of shellImages) {
    const picture = img.closest('picture');
    if (picture) {
      const mainContainer = picture.closest('.flex.items-center.w-full') || picture.closest('div');
      if (mainContainer) {
        const usernameLink = mainContainer.querySelector('a[href^="/users/"] span');
        if (usernameLink) {
          const username = usernameLink.textContent.trim();
          if (username && username.length > 0 && username.length < 50) {
            return username;
          }
        }
        
        const usernameDiv = mainContainer.querySelector('.text-xl');
        if (usernameDiv) {
          const username = usernameDiv.textContent.trim();
          if (username && username.length > 0 && username.length < 50) {
            return username;
          }
        }
        
        const allSpans = mainContainer.querySelectorAll('span');
        for (const span of allSpans) {
          const text = span.textContent.trim();
          if (text && text.length > 0 && text.length < 50 && 
              !text.includes('shell') && !text.match(/^\d+$/) && 
              !text.includes('shells') && !text.includes('total') &&
              !text.includes('payout') && !text.includes('hour') &&
              !text.includes('/hr') && !text.includes('%') &&
              !text.includes('efficiency') && !text.includes('ml-1')) {
            return text;
          }
        }
      }
    }
  }
  
  return null;
}


let rankCache = {
  username: null,
  rank: null,
  timestamp: 0,
  cacheDurationMs: 10 * 60 * 1000 
};


let economyCache = {
  totalEconomyShells: null,
  totalUsers: null,
  shellsEarned: null,
  shellsSpent: null,
  timestamp: 0,
  cacheDurationMs: 4 * 60 * 60 * 1000 
};




async function fetchUserRank(username) {
  if (!username) return null;
  
  const now = Date.now();
  if (rankCache.username === username && 
      rankCache.rank !== null && 
      (now - rankCache.timestamp) < rankCache.cacheDurationMs) {
    console.log('SOM Utils: Using cached rank:', rankCache.rank);
    return rankCache.rank;
  }
  
  try {
    
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'fetchUserRank', username: username },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('SOM Utils: Runtime error:', chrome.runtime.lastError);
            resolve(null);
            return;
          }
          
          if (response && response.success) {
            rankCache = {
              username: username,
              rank: response.rank,
              timestamp: now,
              cacheDurationMs: rankCache.cacheDurationMs
            };
            
            resolve(response.rank);
          } else {
            console.warn('SOM Utils: Background script failed:', response?.error || 'Unknown error');
            resolve(null);
          }
        }
      );
    });
  } catch (error) {
    console.warn('SOM Utils: Error in fetchUserRank:', error);
    return null;
  }
}

async function fetchEconomyData() {
  
  const now = Date.now();
  if (economyCache.totalEconomyShells !== null && 
      (now - economyCache.timestamp) < economyCache.cacheDurationMs) {
    console.log('SOM Utils: Using cached economy data');
    return economyCache;
  }
  
  try {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'fetchEconomyData' },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('SOM Utils: Runtime error:', chrome.runtime.lastError);
            resolve(null);
            return;
          }
          
          if (response && response.success) {
            economyCache = {
              ...response.data,
              timestamp: now,
              cacheDurationMs: economyCache.cacheDurationMs
            };
            
            resolve(economyCache);
          } else {
            resolve(null);
          }
        }
      );
    });
  } catch (error) {
    console.warn('SOM Utils: Error in fetchEconomyData:', error);
    return null;
  }
}


async function displayUserRank() {
  const existingRank = document.querySelector('.som-rank');
  if (existingRank) {
    return; 
  }

  const username = getCurrentUsername();
  if (!username) {
    return;
  }
  const currentShells = getCurrentUserShells();
  if (!currentShells) {
    return;
  }
  
  
  const rank = await fetchUserRank(username);
  if (!rank) {
    return;
  }
  
  const economyData = await fetchEconomyData();
  let percentage = null;
  
  if (economyData && economyData.totalEconomyShells > 0) {
    percentage = ((currentShells / economyData.totalEconomyShells) * 100).toFixed(1);
    console.log('SOM Utils: Calculated economy percentage:', percentage + '%');
  }
  
  const shellImages = document.querySelectorAll('picture.inline-block.w-4.h-4.flex-shrink-0 img[src*="shell"]');
  
  for (const img of shellImages) {
    const picture = img.closest('picture');
    if (picture) {
      
      const shellContainer = picture.parentElement;
      if (shellContainer) {
        
        if (shellContainer.parentNode.querySelector('.som-rank')) {
          console.log('SOM Utils: Rank already exists in this container');
          return;
        }
        
        
        const rankElement = document.createElement('div');
        rankElement.className = 'som-rank';
        rankElement.innerHTML = `#${rank}`;
        
        
        shellContainer.parentNode.insertBefore(rankElement, shellContainer);
        
        
        const shellSpan = shellContainer.querySelector('span.font-extrabold span.ml-1');
        if (shellSpan && percentage !== null) {
          
          if (shellSpan.querySelector('.som-percentage')) {
            console.log('SOM Utils: Shell span already contains percentage');
            return;
          }
          
          
          const currentText = shellSpan.textContent.trim();
          const shellMatch = currentText.match(/(\d+(?:\.\d+)?)/);
          if (shellMatch) {
            const shellCount = shellMatch[1];
            shellSpan.innerHTML = `${shellCount}<span class="som-percentage"> (${percentage}% of total shells)</span>`;
          }
        }
        
        return;
      }
    }
  }
}

function createCornerBadge(shellsPerHour) {
  const badge = document.createElement('div');
  badge.className = 'som-utils-corner-badge';
  badge.innerHTML = `
    <span class="som-badge-text">${shellsPerHour.toFixed(1)}/hr</span>
  `;
  return badge;
}

function createInlineMetric(shellsPerHour) {
  const metric = document.createElement('p');
  metric.className = 'som-utils-inline-metric';
  metric.innerHTML = `
    <span class="som-metric-value">${shellsPerHour.toFixed(1)}</span>
    <span class="som-metric-label">shells/hour</span>
  `;
  return metric;
}

function createSubtleText(message, isPositive = false) {
  const text = document.createElement('p');
  text.className = `som-utils-subtle-text ${isPositive ? 'positive' : ''}`;
  text.textContent = message;
  return text;
}


function createVoteEstimateDisplay(estimatedVotes, confidence, details = null) {
  const voteDisplay = document.createElement('p');
  voteDisplay.className = `som-utils-vote-estimate som-confidence-${confidence}`;
  
  const multiplier = parseFloat(details?.multiplier || 0);
  const topPercentage = details?.topPercentage || 'Unknown %';
  
  let performanceIcon = '🗳️';
  let performanceText = '';
  let tooltipText = '';
  
  
  if (multiplier >= 23) {
    performanceIcon = '🔥';
    performanceText = 'Excellent';
    tooltipText = `Excellent performance! ${multiplier}x shells/hour. Estimated ${estimatedVotes} votes won. Estimated ELO:: ${details.eloRating}.`;
  } else if (multiplier >= 13) {
    performanceIcon = '⭐';
    performanceText = 'Good';
    tooltipText = `Good performance! ${multiplier}x shells/hour. Estimated ${estimatedVotes} votes won. Estimated ELO:: ${details.eloRating}.`;
  } else if (multiplier >= 10) {
    performanceIcon = '✅';
    performanceText = 'Average';
    tooltipText = `Average performance. ${multiplier}x shells/hour. Estimated ${estimatedVotes} votes won. Estimated ELO:: ${details.eloRating}.`;
  } else {
    performanceIcon = '📉';
    performanceText = 'Below Avg';
    tooltipText = `Below average performance. ${multiplier}x shells/hour. Estimated ${estimatedVotes} votes won. Estimated ELO:: ${details.eloRating}.`;
  }
  
  voteDisplay.setAttribute('aria-label', `Estimated ${estimatedVotes} votes won. ${tooltipText}`);
  
  voteDisplay.innerHTML = `
    <span class="som-vote-icon">${performanceIcon}</span>
    <span class="som-vote-count">~${estimatedVotes} votes</span>
    <span class="som-vote-performance">(${performanceText})</span>
    <div class="som-vote-tooltip">
      <div class="som-tooltip-content">
        <div class="som-tooltip-performance">${performanceText} Performance - ${topPercentage}</div>
        <div class="som-tooltip-stats">${multiplier}x shells/hour</div>
        <div class="som-tooltip-elo">Estimated ELO:: ${details.eloRating}</div>
        <div class="som-tooltip-estimate">Estimated ${estimatedVotes} votes won</div>
      </div>
      <div class="som-tooltip-arrow"></div>
    </div>
  `;
  
  return voteDisplay;
}



class ProjectAIAnalyzer {
  static cache = new Map();
  
  static async analyzeProjectElement(projectElement) {
    try {
      const projectIndex = projectElement.getAttribute('data-project-index');
      
      if (this.cache.has(projectIndex)) {
        return this.cache.get(projectIndex);
      }
      
      const projectData = await this.extractProjectData(projectElement);
      if (!projectData) {
        return null;
      }
      
      const combinedContent = this.combineContent(projectData);
      
      const analysis = await this.analyzeContent(combinedContent);
      if (analysis) {
        this.cache.set(projectIndex, analysis);
      }
      
      return analysis;
    } catch (error) {
      return null;
    }
  }
  
  static async extractProjectData(projectElement) {
    const data = {
      description: '',
      devlogTexts: [],
      readmeContent: '',
      githubUrl: ''
    };
    
    try {
      const descriptionElement = projectElement.querySelector('[data-controller="devlog-card"]');
      if (descriptionElement) {
        const originalHTML = descriptionElement.innerHTML;
        const readMoreButton = descriptionElement.querySelector('button[data-action*="expand"]');
        
        if (readMoreButton) {
          readMoreButton.click();
          await new Promise(resolve => setTimeout(resolve, 150));
        }
        
        data.description = descriptionElement.querySelector('[data-devlog-card-target="content"]')?.textContent?.trim() || '';
        
        if (readMoreButton) {
          descriptionElement.innerHTML = originalHTML;
        }
      }
      
      const devlogElements = projectElement.querySelectorAll('[data-viewable-type="Devlog"]');
      for (const devlog of devlogElements) {
        const devlogText = devlog.querySelector('.prose')?.textContent?.trim();
        if (devlogText) {
          data.devlogTexts.push(devlogText);
        }
      }
      
      const repoButton = projectElement.querySelector('a[href*="github.com"]');
      if (repoButton) {
        data.githubUrl = repoButton.href;
        data.readmeContent = await this.fetchReadmeContent(data.githubUrl);
      }
      
      return data;
    } catch (error) {
      return null;
    }
  }
  
  static async fetchReadmeContent(githubUrl) {
    try {
      const match = githubUrl.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
      if (!match) {
        return '';
      }
      
      const [, username, repo] = match;
      const branches = ['master', 'main'];
      
      for (const branch of branches) {
        const readmeUrl = `https://raw.githubusercontent.com/${username}/${repo}/refs/heads/${branch}/README.md`;
        try {
          const response = await fetch(readmeUrl);
          if (response.ok) {
            const content = await response.text();
            return content;
          }
        } catch (fetchError) {
          console.log(`SOM Utils: Failed to fetch README from ${branch}:`, fetchError);
        }
      }
      
      return '';
    } catch (error) {
      return '';
    }
  }
  
  static stripMarkdown(text) {
    if (!text) return '';
    
    return text
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      .replace(/^[-*]{3,}$/gm, '')
      .replace(/^>\s*/gm, '')
      .replace(/^[\s]*[-*+]\s+/gm, '')
      .replace(/^[\s]*\d+\.\s+/gm, '')
      .replace(/\|/g, ' ')
      .replace(/\\(.)/g, '$1')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .replace(/^\s+|\s+$/g, '')
      .trim();
  }
  
  static combineContent(projectData) {
    const parts = [];
    
    if (projectData.description) {
      parts.push(`Project Description:\n${projectData.description}`);
    }
    
    if (projectData.devlogTexts.length > 0) {
      parts.push(`Devlog Content:\n${projectData.devlogTexts.join('\n\n')}`);
    }
    
    if (projectData.readmeContent) {
      const cleanReadme = this.stripMarkdown(projectData.readmeContent);
      if (cleanReadme) {
        parts.push(`README Content:\n${cleanReadme}`);
      }
    }
    
    return parts.join('\n\n');
  }
  
  static async analyzeContent(content) {
    try {
      if (!window.wasmAI.isReady()) {
        await window.wasmAI.initialize();
      }
      
      if (!window.wasmAI.isReady()) {
        return null;
      }
      
      let wasmResult;
      let retryCount = 0;
      const maxRetries = 10;
      
      while (retryCount <= maxRetries) {
        try {
          wasmResult = window.wasmAI.predict(content);
          break;
        } catch (wasmError) {
          retryCount++;
          if (retryCount > maxRetries) {
            throw wasmError;
          }
          await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
        }
      }
      
      let aiPercentage = wasmResult.chance_ai;
      
      if (typeof aiPercentage !== 'number' || isNaN(aiPercentage)) {
        aiPercentage = 0;
      }
      
      if (aiPercentage <= 1.0) {
        aiPercentage = aiPercentage * 100;
      }
      
      return {
        ai_percentage: aiPercentage,
        raw_response: wasmResult
      };
    } catch (error) {
      return null;
    }
  }
  
  static createProjectAIBadge(analysis) {
    const badge = document.createElement('div');
    badge.className = 'som-project-ai-badge';
    
    let aiPercentage = analysis.ai_percentage;
    if (typeof aiPercentage !== 'number' || isNaN(aiPercentage) || aiPercentage < 0 || aiPercentage > 100) {
      aiPercentage = 0;
    }
    aiPercentage = Math.round(aiPercentage);
    
    if (aiPercentage > 50) {
      badge.classList.add('som-ai-alert');
    }
    function formatMetricName(key) {
      return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    const rawResponse = analysis.raw_response || {};
    
    const metricsData = rawResponse.metrics || {};
    const allMetrics = Object.entries(metricsData)
      .filter(([subKey, subValue]) => subKey !== subValue)
      .map(([subKey, subValue]) => {
        let formattedValue = subValue;
        if (typeof subValue === 'number') {
          formattedValue = subValue % 1 === 0 ? subValue.toString() : subValue.toFixed(3);
        }
        return { 
          key: subKey, 
          value: formattedValue, 
          display: `• ${formatMetricName(subKey)}: ${formattedValue}`,
          isZero: subValue === 0
        };
      })
      .sort((a, b) => {
        if (a.isZero && !b.isZero) return 1;
        if (!a.isZero && b.isZero) return -1;
        return 0;
      });
    
    const visibleMetrics = allMetrics.slice(0, 5);
    const hiddenMetrics = allMetrics.slice(5);
    
    const visibleHTML = visibleMetrics.map(metric => 
      `<div class="som-tooltip-detail">${metric.display}</div>`
    ).join('');
    
    const hiddenHTML = hiddenMetrics.length > 0 ? 
      `<div class="som-tooltip-more-container" style="display: none;">
        ${hiddenMetrics.map(metric => 
          `<div class="som-tooltip-detail">${metric.display}</div>`
        ).join('')}
      </div>
      <div class="som-tooltip-toggle" onclick="this.parentNode.querySelector('.som-tooltip-more-container').style.display = this.parentNode.querySelector('.som-tooltip-more-container').style.display === 'none' ? 'block' : 'none'; this.textContent = this.textContent === 'Show more...' ? 'Show less' : 'Show more...';" style="font-size: 0.6rem; color: #6B5B47; cursor: pointer; margin-top: 4px; text-decoration: underline;">Show more...</div>` 
      : '';
    
    const responseHTML = visibleHTML + hiddenHTML;
    
    const alertIcon = aiPercentage > 50 ? '⚠️ ' : '';
    
    badge.innerHTML = `
      <span class="som-project-ai-percentage">${alertIcon}${aiPercentage}% AI</span>
      <div class="som-vote-tooltip">
        <div class="som-tooltip-content">
          <div class="som-tooltip-stats">Project AI Detection: ${aiPercentage}%</div>
          <div class="som-tooltip-evidence">Analysis includes project description, all devlogs, and README content</div>
          ${responseHTML ? `<div class="som-tooltip-evidence">Raw Model Response:</div>${responseHTML}` : '<div class="som-tooltip-evidence">No additional data available</div>'}
        </div>
        <div class="som-tooltip-arrow"></div>
      </div>
    `;
    
    badge.setAttribute('aria-label', `Project AI Detection: ${aiPercentage}%`);
    
    return badge;
  }
  
  static calculateDevlogsPerHour(projectElement) {
    try {
      const statsElement = projectElement.querySelector('.flex.flex-wrap.items-center.space-x-2');
      if (!statsElement) return null;
      
      const statsText = statsElement.textContent;
      const devlogMatch = statsText.match(/(\d+)\s*devlogs?/);
      const timeMatch = statsText.match(/(\d+)h(?:\s*(\d+)m)?/);
      
      if (!devlogMatch || !timeMatch) return null;
      
      const devlogCount = parseInt(devlogMatch[1]);
      const hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      const totalHours = hours + (minutes / 60);
      
      if (totalHours === 0) return null;
      
      const devlogsPerHour = devlogCount / totalHours;
      return {
        devlogsPerHour: devlogsPerHour,
        devlogCount: devlogCount,
        totalHours: totalHours
      };
    } catch (error) {
      console.error('SOM Utils: Error calculating devlogs/hour:', error);
      return null;
    }
  }
  
  static createDevlogRateBadge(devlogsPerHour, devlogCount, totalHours) {
    const badge = document.createElement('span');
    badge.className = 'som-devlog-rate-stat';
    
    const hoursPerDevlog = totalHours / devlogCount;
    let displayText = '';
    
    if (hoursPerDevlog < 1) {
      const minutesPerDevlog = Math.round(hoursPerDevlog * 60);
      displayText = `1 devlog per ${minutesPerDevlog}m`;
    } else {
      const roundedHours = Math.round(hoursPerDevlog * 10) / 10;
      displayText = `1 devlog per ${roundedHours}h`;
    }
    
    badge.textContent = displayText;
    badge.setAttribute('title', `Development rate: ${displayText} on average`);
    
    return badge;
  }
  
  static async displayProjectAnalysis(projectElement, analysis) {
    try {
      const existingAIBadge = projectElement.querySelector('.som-project-ai-badge');
      const existingDevlogsBadge = projectElement.querySelector('.som-devlog-rate-stat');
      const existingSeparators = projectElement.querySelectorAll('.som-voting-separator');
      if (existingAIBadge) existingAIBadge.remove();
      if (existingDevlogsBadge) existingDevlogsBadge.remove();
      existingSeparators.forEach(sep => sep.remove());
      const aiBadge = this.createProjectAIBadge(analysis);
      const devlogStats = this.calculateDevlogsPerHour(projectElement);
      let devlogRateStat = null;
      if (devlogStats) {
        devlogRateStat = this.createDevlogRateBadge(
          devlogStats.devlogsPerHour, 
          devlogStats.devlogCount, 
          devlogStats.totalHours
        );
      }
      
      if (devlogRateStat) {
        const statsElement = projectElement.querySelector('.flex.flex-wrap.items-center.space-x-2');
        if (statsElement) {
          const separator = document.createElement('span');
          separator.textContent = '•';
          separator.className = 'som-voting-separator';
          statsElement.appendChild(separator);
          statsElement.appendChild(devlogRateStat);
        }
      }
      
      const titleElement = projectElement.querySelector('h3');
      if (titleElement) {
        const titleText = titleElement.textContent.trim();
        const titleLength = titleText.length;
        
        if (titleLength <= 20) {
          const wrapper = document.createElement('div');
          wrapper.className = 'som-title-badge-wrapper';
          titleElement.parentNode.insertBefore(wrapper, titleElement);
          wrapper.appendChild(titleElement);
          aiBadge.classList.add('som-badge-next-to-title');
          wrapper.appendChild(aiBadge);
        } else {
          const statsElement = projectElement.querySelector('.flex.flex-wrap.items-center.space-x-2');
          if (statsElement) {
            const separator = document.createElement('span');
            separator.textContent = '•';
            separator.className = 'som-voting-separator';
            statsElement.appendChild(separator);
            statsElement.appendChild(aiBadge);
          }
        }
      }
      
      projectElement.setAttribute('data-som-project-analyzed', 'true');
      
    } catch (error) {
      console.error('SOM Utils: Error displaying project analysis:', error);
    }
  }
}

class DevlogAIAnalyzer {
  static async analyzeDevlogElement(devlogElement) {
    try {
      const devlogId = devlogElement.getAttribute('data-viewable-id');
      
      let content = '';
      const readMoreButton = devlogElement.querySelector('button[data-action*="expand"]');
      
      if (readMoreButton) {
        const originalHTML = devlogElement.innerHTML;
        readMoreButton.click();
        await new Promise(resolve => setTimeout(resolve, 150));
        content = devlogElement.querySelector('.prose')?.textContent?.trim() || '';
        devlogElement.innerHTML = originalHTML;
      } else {
        content = devlogElement.querySelector('.prose')?.textContent?.trim() || '';
      }
      
      if (!content) {
        return null;
      }
      
      try {
        if (!window.wasmAI.isReady()) {
          await window.wasmAI.initialize();
        }
        
        if (!window.wasmAI.isReady()) {
          return null;
        }
        
        let wasmResult;
        let retryCount = 0;
        const maxRetries = 10;
        
        while (retryCount <= maxRetries) {
          try {
            wasmResult = window.wasmAI.predict(content);
            break; 
          } catch (wasmError) {
            retryCount++;
            if (retryCount > maxRetries) {
              console.error(`SOM Utils: prediction failed after ${maxRetries} retries for devlog ${devlogId}`);
              throw wasmError;
            }
            
            await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
          }
        }
        
        let aiPercentage = wasmResult.chance_ai;
        
        if (typeof aiPercentage !== 'number' || isNaN(aiPercentage)) {
          aiPercentage = 0;
        }

        if (aiPercentage <= 1.0) {
          aiPercentage = aiPercentage * 100;
        }

        const analysis = {
          ai_percentage: aiPercentage,
          raw_response: wasmResult
        };
        
        return analysis;
      } catch (error) {
        return null;
      }
      
    } catch (error) {
      return null;
    }
  }
  
  
  static displayDevlogAIBadge(devlogElement, analysis) {
    try {
      const devlogId = devlogElement.getAttribute('data-viewable-id');
      
      if (devlogElement.querySelector('.som-devlog-ai-badge') || 
          devlogElement.hasAttribute('data-som-devlog-analyzed')) {
        return;
      }
      
      const badge = this.createDevlogAIBadge(analysis);
      
      if (!badge) {
        return null;
      }
      
      let header = devlogElement.querySelector('.flex.items-center.justify-between.mb-2.sm\\:mb-3');
      if (!header) {
        header = devlogElement.querySelector('.flex.items-center.justify-between');
      }
      if (!header) {
        header = devlogElement.querySelector('.flex.items-center');
      }
      
      if (header) {
        const badgeContainer = document.createElement('div');
        badgeContainer.className = 'som-devlog-ai-container';
        badgeContainer.appendChild(badge);
        
        header.appendChild(badgeContainer);
        devlogElement.setAttribute('data-som-devlog-analyzed', 'true');
        return badge;
      } else {
        return null;
      }
      
    } catch (error) {
      console.error('SOM Utils: Error displaying badge:', error);
    }
  }
  
  static createDevlogAIBadge(analysis) {
    const badge = document.createElement('div');
    badge.className = 'som-devlog-ai-badge';
    
    let aiPercentage = analysis.ai_percentage;
    if (typeof aiPercentage !== 'number' || isNaN(aiPercentage) || aiPercentage < 0 || aiPercentage > 100) {
      aiPercentage = 0;
    }
    aiPercentage = Math.round(aiPercentage);
    
    if (aiPercentage > 50) {
      badge.classList.add('som-ai-alert');
    }
    
    function formatMetricName(key) {
      return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    const response = analysis.raw_response || {};
    
    const metricsData = response.metrics || {};
    
    const allMetrics = Object.entries(metricsData)
      .filter(([subKey, subValue]) => subKey !== subValue)
      .map(([subKey, subValue]) => {
        let formattedValue = subValue;
        if (typeof subValue === 'number') {
          formattedValue = subValue % 1 === 0 ? subValue.toString() : subValue.toFixed(3);
        }
        return { 
          key: subKey, 
          value: formattedValue, 
          display: `• ${formatMetricName(subKey)}: ${formattedValue}`,
          isZero: subValue === 0
        };
      })
      .sort((a, b) => {
        if (a.isZero && !b.isZero) return 1;
        if (!a.isZero && b.isZero) return -1;
        return 0;
      });
    
    const visibleMetrics = allMetrics.slice(0, 5);
    const hiddenMetrics = allMetrics.slice(5);
    
    const visibleHTML = visibleMetrics.map(metric => 
      `<div class="som-tooltip-detail">${metric.display}</div>`
    ).join('');
    
    const hiddenHTML = hiddenMetrics.length > 0 ? 
      `<div class="som-tooltip-more-container" style="display: none;">
        ${hiddenMetrics.map(metric => 
          `<div class="som-tooltip-detail">${metric.display}</div>`
        ).join('')}
      </div>
      <div class="som-tooltip-toggle" onclick="this.parentNode.querySelector('.som-tooltip-more-container').style.display = this.parentNode.querySelector('.som-tooltip-more-container').style.display === 'none' ? 'block' : 'none'; this.textContent = this.textContent === 'Show more...' ? 'Show less' : 'Show more...';" style="font-size: 0.6rem; color: #6B5B47; cursor: pointer; margin-top: 4px; text-decoration: underline;">Show more...</div>` 
      : '';
    
    const responseHTML = visibleHTML + hiddenHTML;
    
    const alertIcon = aiPercentage > 50 ? '⚠️ ' : '';
    
    badge.innerHTML = `
      <span class="som-devlog-ai-percentage">${alertIcon}${aiPercentage}%</span>
      <div class="som-vote-tooltip">
        <div class="som-tooltip-content">
          <div class="som-tooltip-stats">AI Detection: ${aiPercentage}%</div>
          ${responseHTML ? `<div class="som-tooltip-evidence">Metrics:</div>${responseHTML}` : '<div class="som-tooltip-evidence">No additional data available</div>'}
        </div>
        <div class="som-tooltip-arrow"></div>
      </div>
    `;
    
    badge.setAttribute('aria-label', `AI Detection: ${aiPercentage}%`);
    
    return badge;
  }
}

class VotingProjectAnalyzer {
  static async processDualProjects() {
    const project0 = document.querySelector('[data-project-index="0"]');
    const project1 = document.querySelector('[data-project-index="1"]');
    
    if (project0 && project1) {
      
      const promises = [
        this.analyzeProjectDevlogs(project0),
        this.analyzeProjectDevlogs(project1)
      ];
      
      await Promise.all(promises);
    }
  }
  
  static async analyzeProjectDevlogs(projectElement) {
    try {
      const devlogElements = projectElement.querySelectorAll('[data-viewable-type="Devlog"]');
      
      if (devlogElements.length === 0) {
        return;
      }
      
      for (const devlogElement of devlogElements) {
        try {
          const devlogId = devlogElement.getAttribute('data-viewable-id');
          
          if (devlogElement.hasAttribute('data-som-devlog-analyzed')) {
            continue;
          }
          
          const analysis = await DevlogAIAnalyzer.analyzeDevlogElement(devlogElement);
          
          if (analysis) {
            const badge = DevlogAIAnalyzer.displayDevlogAIBadge(devlogElement, analysis);
           
          }
          
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error('SOM Utils: Error analyzing individual devlog:', error);
        }
      }
           
    } catch (error) {
      console.error('SOM Utils: Error in analyzeProjectDevlogs:', error);
    }
  }
}

function addShellsPerHourToCard(card) {
  if (card.querySelector('[class*="som-utils"]')) {
    return;
  }
  
  const grayTexts = card.querySelectorAll('p.text-gray-400');
  
  let timeText = '';
  let shellsText = '';
  let hasCertificationReview = false;
  
  grayTexts.forEach(p => {
    if (p.classList.contains('som-utils-subtle-text')) {
      return;
    }
    
    const text = p.textContent.trim();
    if (text.match(/\d+[hm]/)) {
      timeText = text.split('\n')[0];
    }
    if (text.includes('shells') || text.includes('ship this project')) {
      shellsText = text;
    }
    if (text.includes('Project is awaiting ship certification!')) {
      hasCertificationReview = true;
    }
  });
  
  if (hasCertificationReview) {
    shellsText = 'Project is awaiting ship certification!';
  }
  
  if (!timeText) return;
  
  const hours = parseTimeString(timeText);
  const shells = parseShellsString(shellsText);
  const shellsPerHour = calculateShellsPerHour(shells, hours);
  
  if (shells > 0 && hours > 0) {
    saveUserEfficiency(shells, hours);
    
    
    const voteEstimation = VoteEstimationService.estimateVotes(shells, hours);
    if (voteEstimation.estimatedVotes > 0) {
      const voteDisplay = createVoteEstimateDisplay(voteEstimation.estimatedVotes, voteEstimation.confidence, voteEstimation.details);
      const lastGrayText = card.querySelector('p.text-gray-400:last-of-type');
      if (lastGrayText && lastGrayText.parentNode) {
        lastGrayText.parentNode.insertBefore(voteDisplay, lastGrayText.nextSibling);
      }
    }
  } else if (shells === -1 && hours > 0 && hasCertificationReview) {
    const reviewDisplay = createSubtleText('🔍 Awaiting ship certification', true);
    const lastGrayText = card.querySelector('p.text-gray-400:last-of-type');
    if (lastGrayText && lastGrayText.parentNode) {
      lastGrayText.parentNode.insertBefore(reviewDisplay, lastGrayText.nextSibling);
    }
  }
  
  let displayElement;
  
  if (hours === 0) {
    displayElement = createSubtleText('⏱️ No time tracked yet');
  } else if (shells === -1 && hasCertificationReview) {
    displayElement = createSubtleText('🔍 Ship certification review', true);
  } else if (shells === 0) {
    displayElement = createSubtleText('🚀 Ship to earn shells!', true);
  } else if (shellsPerHour >= 10) {
    displayElement = createCornerBadge(shellsPerHour);
    
    const cardContainer = card.querySelector('div');
    if (cardContainer) {
      cardContainer.style.position = 'relative';
      cardContainer.appendChild(displayElement);
      return;
    }
  } else if (shellsPerHour > 0) {
    displayElement = createInlineMetric(shellsPerHour);
  }
  
  if (displayElement && !displayElement.classList.contains('som-utils-corner-badge')) {
    const lastGrayText = card.querySelector('p.text-gray-400:last-of-type');
    if (lastGrayText && lastGrayText.parentNode) {
      lastGrayText.parentNode.insertBefore(displayElement, lastGrayText.nextSibling);
    }
  }
}

function saveTotalHoursData(totalHours) {
  const currentData = localStorage.getItem('som-utils-total-hours');
  let existingData = null;
  
  if (currentData) {
    try {
      existingData = JSON.parse(currentData);
    } catch (error) {
      console.error('SOM Utils: Error parsing existing total hours data:', error);
    }
  }
  
  if (existingData && Math.abs(existingData.totalHours - totalHours) < 0.01) {
    return;
  }
  
  const data = {
    totalHours: totalHours,
    timestamp: Date.now(),
    lastUpdated: new Date().toISOString()
  };
  
  localStorage.setItem('som-utils-total-hours', JSON.stringify(data));
  console.log('SOM Utils: Saved total hours data:', data);
}

function getTotalHoursData() {
  const data = localStorage.getItem('som-utils-total-hours');
  if (!data) {
    return { totalHours: 0, timestamp: 0, lastUpdated: null };
  }
  
  try {
    return JSON.parse(data);
  } catch (error) {
    console.error('SOM Utils: Error parsing total hours data:', error);
    return { totalHours: 0, timestamp: 0, lastUpdated: null };
  }
}

function calculateTotalStats(projectData) {
  let totalHours = 0;
  let totalDevlogs = 0;
  let projectsWithData = 0;

  projectData.forEach(project => {
    if (project.hours > 0) {
      totalHours += project.hours;
      projectsWithData++;
    }
  });

  const projectCards = document.querySelectorAll('a[href^="/projects/"]');
  const actualProjectCards = Array.from(projectCards).filter(card => {
    const hasCreateText = card.textContent.toLowerCase().includes('create project');
    const hasProjectId = card.href.match(/\/projects\/\d+$/);
    return !hasCreateText && hasProjectId;
  });

  const allProjectCards = document.querySelectorAll('.bg-\\[\\#F3ECD8\\]') || 
                          document.querySelectorAll('div[class*="rounded-2xl"]');
  
  if (allProjectCards.length === 0) {
    const allDivs = document.querySelectorAll('div');
    allProjectCards = Array.from(allDivs).filter(div => 
      div.className.includes('bg-[#F3ECD8]') || 
      div.className.includes('rounded-2xl')
    );
  }
  
  allProjectCards.forEach(card => {
    const grayTexts = card.querySelectorAll('p.text-gray-400');
    grayTexts.forEach(p => {
      const text = p.textContent;
      const devlogMatch = text.match(/(\d+)\s*devlogs?/);
      if (devlogMatch) {
        totalDevlogs += parseInt(devlogMatch[1]);
      }
    });
  });

  const roundedTotalHours = Math.round(totalHours * 10) / 10;
  
  saveTotalHoursData(roundedTotalHours);

  return {
    totalHours: roundedTotalHours,
    totalDevlogs,
    projectsWithData
  };
}

function createTotalStatsBox(stats) {
  const statsBox = document.createElement('div');
  statsBox.className = 'som-total-stats-box som-compact-stats';
  const hoursPerDevlog = stats.totalHours / stats.totalDevlogs;
    let displayText = '';
    
    if (hoursPerDevlog < 1) {
      const minutesPerDevlog = Math.round(hoursPerDevlog * 60);
      displayText = `1 devlog per ${minutesPerDevlog}m`;
    } else {
      const roundedHours = Math.round(hoursPerDevlog * 10) / 10;
      displayText = `1 devlog per ${roundedHours}h`;
    }
  statsBox.innerHTML = `
    <div class="som-stats-compact">
      <span class="som-stats-text">Total: ${stats.totalHours}h • ${stats.totalDevlogs} devlogs • ${displayText}</span>
    </div>
  `;
  return statsBox;
}

function addTotalStatsBox(projectData) {
  if (document.querySelector('.som-total-stats-box')) {
    return;
  }

  const stats = calculateTotalStats(projectData);
  const statsBox = createTotalStatsBox(stats);

  const headerContainer = document.querySelector('div[style*="display: flex"][style*="justify-content: space-between"]');
  
  if (headerContainer) {
    const leftSide = headerContainer.querySelector('div[style*="flex: 1 1 0%"]') || 
                     headerContainer.querySelector('div:first-child');
    
    if (leftSide) {
      const subtitle = leftSide.querySelector('p');
      if (subtitle) {
        leftSide.insertBefore(statsBox, subtitle.nextSibling);
      } else {
        leftSide.appendChild(statsBox);
      }
    } else {
      headerContainer.appendChild(statsBox);
    }
  } else {
    const myProjectsTitle = document.querySelector('h1[class*="font-[Dynapuff]"]') ||
                            document.querySelector('h1');
    
    if (myProjectsTitle && myProjectsTitle.parentNode) {
      const subtitle = myProjectsTitle.parentNode.querySelector('p');
      if (subtitle) {
        myProjectsTitle.parentNode.insertBefore(statsBox, subtitle.nextSibling);
      } else {
        myProjectsTitle.parentNode.appendChild(statsBox);
      }
    }
  }
}

function processProjectCards() {
  let projectCards = document.querySelectorAll('a[href^="/projects/"]');
  let actualProjectCards = Array.from(projectCards).filter(card => {
    const hasCreateText = card.textContent.toLowerCase().includes('create project');
    const hasProjectId = card.href && card.href.match(/\/projects\/\d+$/);
    return !hasCreateText && hasProjectId;
  });

  if (actualProjectCards.length === 0) {
    let divCards = document.querySelectorAll('.bg-\\[\\#F3ECD8\\]') || 
                   document.querySelectorAll('div[class*="rounded-2xl"]');
    
    if (divCards.length === 0) {
      const allDivs = document.querySelectorAll('div');
      divCards = Array.from(allDivs).filter(div => 
        div.className.includes('bg-[#F3ECD8]') || 
        div.className.includes('rounded-2xl')
      );
    }
    
    actualProjectCards = Array.from(divCards).filter(card => {
      const hasCreateText = card.textContent.toLowerCase().includes('create project');
      return !hasCreateText && card.querySelector('h2, h3');
    });
  }
  
  const projectData = [];
  
  actualProjectCards.forEach((card, index) => {
    addShellsPerHourToCard(card);
    
    const data = extractProjectSortingData(card, index);
    if (data) {
      projectData.push(data);
      card.setAttribute('data-som-index', index);
    }
  });
  
  if (projectData.length > 1 && window.location.pathname === '/my_projects') {
    addProjectSortInterface(actualProjectCards, projectData);
  }
  
  if (window.location.pathname === '/my_projects' && projectData.length > 0) {
    addTotalStatsBox(projectData);
  }
}

function extractProjectSortingData(card, index) {
  const grayTexts = card.querySelectorAll('p.text-gray-400');
  
  let timeText = '';
  let shellsText = '';
  let title = '';
  let hasCertificationReview = false;
  
  const titleElement = card.querySelector('h2, h3, .font-bold, [class*="text-lg"]') || card.querySelector('p:not(.text-gray-400)');
  if (titleElement) {
    title = titleElement.textContent.trim();
  }
  
  grayTexts.forEach(p => {
    if (p.classList.contains('som-utils-subtle-text')) {
      return;
    }
    
    const text = p.textContent.trim();
    if (text.match(/\d+[hm]/)) {
      timeText = text.split('\n')[0];
    }
    if (text.includes('shells') || text.includes('ship this project')) {
      shellsText = text;
    }
    if (text.includes('Project is awaiting ship certification!')) {
      hasCertificationReview = true;
    }
  });
  
  if (hasCertificationReview) {
    shellsText = 'Project is awaiting ship certification!';
  }
  
  if (!timeText) return null;
  
  const hours = parseTimeString(timeText);
  const shells = parseShellsString(shellsText);
  const efficiency = shells === -1 ? -1 : calculateShellsPerHour(shells, hours); 
  
  return {
    index: index,
    card: card,
    title: title,
    hours: hours,
    shells: shells,
    efficiency: efficiency,
    timeText: timeText,
    shellsText: shellsText
  };
}

function getSortPreference() {
  return localStorage.getItem('som-project-sort') || 'default';
}

function setSortPreference(sortBy) {
  localStorage.setItem('som-project-sort', sortBy);
}

function createProjectSortInterface() {
  const sortContainer = document.createElement('div');
  sortContainer.className = 'som-sort-interface';
  sortContainer.setAttribute('role', 'region');
  sortContainer.setAttribute('aria-label', 'Project sorting controls');
  
  const currentSort = getSortPreference();
  
  sortContainer.innerHTML = `
    <div class="som-sort-content">
      <div class="som-sort-label">
        <span class="som-sort-icon">📊</span>
        <span class="som-sort-text">Sort by:</span>
      </div>
      <select class="som-sort-dropdown" aria-label="Sort projects by">
        <option value="default" ${currentSort === 'default' ? 'selected' : ''}>Default</option>
        <option value="hours-desc" ${currentSort === 'hours-desc' ? 'selected' : ''}>Most Hours</option>
        <option value="hours-asc" ${currentSort === 'hours-asc' ? 'selected' : ''}>Least Hours</option>
        <option value="shells-desc" ${currentSort === 'shells-desc' ? 'selected' : ''}>Most Shells</option>
        <option value="shells-asc" ${currentSort === 'shells-asc' ? 'selected' : ''}>Least Shells</option>
        <option value="efficiency-desc" ${currentSort === 'efficiency-desc' ? 'selected' : ''}>Best Efficiency</option>
        <option value="efficiency-asc" ${currentSort === 'efficiency-asc' ? 'selected' : ''}>Worst Efficiency</option>
        <option value="title-asc" ${currentSort === 'title-asc' ? 'selected' : ''}>A to Z</option>
        <option value="title-desc" ${currentSort === 'title-desc' ? 'selected' : ''}>Z to A</option>
      </select>
    </div>
  `;
  
  return sortContainer;
}

function sortProjectData(projectData, sortBy) {
  if (sortBy === 'default') {
    return projectData.sort((a, b) => a.index - b.index);
  } 
  
  const [field, direction] = sortBy.split('-'); 
  const isDescending = direction === 'desc';
  
  return projectData.sort((a, b) => {
    let valueA, valueB;
    
    switch (field) {
      case 'hours':
        valueA = a.hours;
        valueB = b.hours;
        break;
      case 'shells':
        valueA = a.shells;
        valueB = b.shells;
        break;
      case 'efficiency':
        valueA = a.efficiency;
        valueB = b.efficiency;
        break;
      case 'title':
        valueA = a.title.toLowerCase();
        valueB = b.title.toLowerCase();
        break;
      default:
        return 0;
    }
    
    if (field === 'title') {
      if (valueA < valueB) return isDescending ? 1 : -1;
      if (valueA > valueB) return isDescending ? -1 : 1;
      return 0;
    } else {
      if (isDescending) {
        return valueB - valueA;
      } else {
        return valueA - valueB;
      }
    }
  });
}

function applySorting(projectCards, projectData) {
  const sortBy = getSortPreference();
  const sortedData = sortProjectData([...projectData], sortBy);
  
  const container = projectCards[0]?.parentNode;
  if (!container) return;

  const ProjectCards = Array.from(projectCards);
  ProjectCards.forEach(card => card.remove());
  
  sortedData.forEach(data => {
    container.appendChild(data.card);
  });
  
  console.log('SOM Utils: Sorted', sortedData.length, 'projects by', sortBy);
}

function addProjectSortInterface(projectCards, projectData) {
  if (document.querySelector('.som-sort-interface')) {
    return;
  }
  
  const sortInterface = createProjectSortInterface();
  sortInterface.classList.add('som-sort-inline');
  
  const headerDiv = document.querySelector('div.mb-8.md\\:mt-\\[53\\].mt-4') || 
                    document.querySelector('div:has(h1):has(p)') ||
                    document.querySelector('div:has([class*="font-\\[Dynapuff\\]"])');
  
  if (headerDiv) {
    headerDiv.style.display = 'flex';
    headerDiv.style.justifyContent = 'space-between';
    headerDiv.style.alignItems = 'flex-end';
    headerDiv.style.flexWrap = 'wrap';
    headerDiv.style.gap = '16px';
    
    const contentWrapper = document.createElement('div');
    contentWrapper.style.flex = '1';
    
    while (headerDiv.firstChild) {
      contentWrapper.appendChild(headerDiv.firstChild);
    }
    
    headerDiv.appendChild(contentWrapper);
    headerDiv.appendChild(sortInterface);
    
  } else {
    const myProjectsHeading = document.querySelector('h1');
    const whatBuildinParagraph = document.querySelector('p');
    
    if (myProjectsHeading && whatBuildinParagraph && 
        myProjectsHeading.textContent.includes('My Projects') &&
        whatBuildinParagraph.textContent.includes('What\'ya buildin\'?')) {
      
      const headerContainer = myProjectsHeading.parentNode;
      if (headerContainer) {
        
        headerContainer.style.display = 'flex';
        headerContainer.style.justifyContent = 'space-between';
        headerContainer.style.alignItems = 'flex-end';
        headerContainer.style.flexWrap = 'wrap';
        headerContainer.style.gap = '16px';
        
        const contentWrapper = document.createElement('div');
        contentWrapper.style.flex = '1';
        
        while (headerContainer.firstChild) {
          contentWrapper.appendChild(headerContainer.firstChild);
        }
        
        headerContainer.appendChild(contentWrapper);
        headerContainer.appendChild(sortInterface);
        
      }
    } else {
      
      const container = projectCards[0]?.parentNode;
      if (container) {
        const gridContainer = container.closest('[class*="grid"]') || container;
        if (gridContainer.parentNode) {
          gridContainer.parentNode.insertBefore(sortInterface, gridContainer);
        }
      }
    }
  }
  
  
  const dropdown = sortInterface.querySelector('.som-sort-dropdown');
  dropdown.addEventListener('change', (e) => {
    const newSort = e.target.value;
    setSortPreference(newSort);
    applySorting(projectCards, projectData);
    
  });
  
  
  applySorting(projectCards, projectData);
  
}


function calculateProjectTotalEfficiency() {
  const shipElements = document.querySelectorAll('p');
  let totalShells = 0;
  
  shipElements.forEach(shipElement => {
    if (shipElement.textContent.includes('payout of') && shipElement.textContent.includes('shells')) {
      const shellsMatch = shipElement.textContent.match(/(\d+(?:\.\d+)?)\s*shells/);
      if (shellsMatch) {
        totalShells += parseFloat(shellsMatch[1]);
      }
    }
  });
  
  const svgElements = document.querySelectorAll('svg[width="50"][height="53"]');
  let totalHours = 0;
  
  svgElements.forEach(svg => {
    const container = svg.closest('div');
    if (container) {
      const timeSpan = container.querySelector('span.text-som-dark');
      if (timeSpan) {
        const text = timeSpan.textContent.trim();
        if (text.match(/\d+h(?:\s+\d+m)?/)) {
          totalHours = parseTimeString(text);
        }
      }
    }
  });
  
  
  return totalHours > 0 ? calculateShellsPerHour(totalShells, totalHours) : 0;
}

function addProjectBannerBadge() {
  if (document.querySelector('.som-utils-project-banner-badge')) {
    return;
  }

  const totalEfficiency = calculateProjectTotalEfficiency();
  if (totalEfficiency <= 0) return;
  
  const badge = createCornerBadge(totalEfficiency);
  badge.className = 'som-utils-project-banner-badge som-utils-corner-badge';
  
  const bannerArea = document.querySelector('div[id*="ba"]') || document.querySelector('div[class*="bg-"]') || document.querySelector('header') || document.querySelector('main > div:first-child');
  if (bannerArea) {
    bannerArea.style.position = 'relative';
    bannerArea.appendChild(badge);
  } 
}

function processProjectPage() {
  addProjectBannerBadge();
  const projectElement = document.querySelector('[data-project-index]');
  if (projectElement) {
    processProjectAIAnalysis(projectElement);
  }
  addAICheckButton();
}

function addAICheckButton() {
  if (document.querySelector('.som-ai-check-button')) {
    return;
  }
  
  let buttonContainer = document.querySelector('.flex.items-center.space-x-3.md\\:space-x-4.md\\:ml-4');
  if (!buttonContainer) {
    buttonContainer = document.querySelector('.flex.items-center.space-x-3');
  }
  if (!buttonContainer) {
    buttonContainer = document.querySelector('.flex.items-center.gap-3');
  }
  if (!buttonContainer) {
    const allButtons = document.querySelectorAll('.som-button-primary, .som-button-danger');
    if (allButtons.length >= 2) {
      buttonContainer = allButtons[0].parentElement;
    }
  }
  
  if (!buttonContainer) {
    return;
  }
  
  const aiCheckButton = document.createElement('button');
  aiCheckButton.className = 'som-button-primary som-ai-check-button';
  aiCheckButton.style.cssText = 'padding: 6px 12px; font-size: 0.8rem;';
  aiCheckButton.innerHTML = `
    <div class="flex items-center justify-center">
      <span>Check AI</span>
    </div>
  `;

  aiCheckButton.addEventListener('click', async () => {
    await performIndividualProjectAnalysis(aiCheckButton);
  });
  
  const deleteButton = buttonContainer.querySelector('.som-button-danger');
  if (deleteButton && deleteButton.parentNode === buttonContainer) {
    buttonContainer.insertBefore(aiCheckButton, deleteButton);
  } else {
    buttonContainer.appendChild(aiCheckButton);
  }
}

async function extractIndividualProjectData() {
  const data = {
    title: '',
    description: '',
    devlogTexts: [],
    readmeContent: '',
    githubUrl: ''
  };
  
  try {
    const titleElement = document.querySelector('h1.text-2xl, h1[class*="text-2xl"]');
    if (titleElement) {
      data.title = titleElement.textContent.trim();
    }
    
    const descriptionElement = document.querySelector('.mb-4.text-base p, .mb-4[class*="text-base"] p');
    if (descriptionElement) {
      data.description = descriptionElement.textContent.trim();
    }
    
    const repoButton = document.querySelector('a[href*="github.com"]');
    if (repoButton) {
      data.githubUrl = repoButton.href;
    }
    
    const readmeButton = document.querySelector('a[href*="README.md"], a[href*="readme.md"]');
    if (readmeButton) {
        const readmeUrl = readmeButton.href;
        const response = await fetch(readmeUrl);
        if (response.ok) {
          data.readmeContent = await response.text();
        }
    }

    const devlogCards = document.querySelectorAll('[data-viewable-type="Devlog"]');
    for (const devlogCard of devlogCards) {
        const proseElement = devlogCard.querySelector('.prose, [data-devlog-card-target="content"]');
        if (proseElement) {
          const devlogText = proseElement.textContent.trim();
          if (devlogText && devlogText.length > 10) {
            data.devlogTexts.push(devlogText);
          }
        }
      }
    return data;
  } catch (error) {
    return data;
  }
}

async function performIndividualProjectAnalysis(buttonElement) {
  try {
    updateAICheckButtonState(buttonElement, 'loading');
    const projectData = await extractIndividualProjectData();
    
    if (!projectData.title && !projectData.description && projectData.devlogTexts.length === 0) {
      throw new Error('No project content found to analyze');
    }
    
    const combinedContent = ProjectAIAnalyzer.combineContent(projectData);
    
    const projectAnalysis = await ProjectAIAnalyzer.analyzeContent(combinedContent);
    
    if (projectAnalysis) {
      await displayIndividualProjectResults(projectAnalysis);
      await analyzeIndividualDevlogs();
      updateAICheckButtonState(buttonElement, 'completed');
    } else {
      throw new Error('AI analysis returned no results');
    }
    
  } catch (error) {
    updateAICheckButtonState(buttonElement, 'error');
  }
}

function updateAICheckButtonState(buttonElement, state) {
  const buttonContent = buttonElement.querySelector('div');
  
  switch (state) {
    case 'loading':
      buttonElement.disabled = true;
      buttonElement.style.opacity = '0.7';
      buttonContent.innerHTML = `<span>Analyzing...</span>`;
      break;
      
    case 'completed':
      buttonElement.disabled = false;
      buttonElement.style.opacity = '1';
      buttonContent.innerHTML = `<span>Refresh</span>`;
      break;
      
    case 'error':
      buttonElement.disabled = false;
      buttonElement.style.opacity = '1';
      buttonContent.innerHTML = `<span>Try Again</span>`;
      break;
  }
}

function cleanupIndividualProjectBadges() {
  const individualBadges = document.querySelectorAll('.som-individual-project-ai-badge');
  const individualSeparators = document.querySelectorAll('.som-individual-project-separator');
  individualBadges.forEach(badge => badge.remove());
  individualSeparators.forEach(sep => sep.remove());
  const aiCheckButton = document.querySelector('.som-ai-check-button');
  if (aiCheckButton) {
    const buttonContent = aiCheckButton.querySelector('.flex');
    if (buttonContent) {
      buttonContent.innerHTML = '<span>Check AI</span>';
    }
    aiCheckButton.disabled = false;
    aiCheckButton.style.opacity = '1';
  }
}

window.addEventListener('beforeunload', cleanupIndividualProjectBadges);
window.addEventListener('pagehide', cleanupIndividualProjectBadges);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    cleanupIndividualProjectBadges();
  }
});

document.addEventListener('turbo:before-visit', cleanupIndividualProjectBadges);
document.addEventListener('turbo:before-cache', cleanupIndividualProjectBadges);

async function displayIndividualProjectResults(analysis) {
    cleanupIndividualProjectBadges();
    const projectBadge = ProjectAIAnalyzer.createProjectAIBadge(analysis);
    projectBadge.classList.add('som-individual-project-ai-badge');
    const statsContainer = document.querySelector('.flex.gap-3.flex-wrap.items-center.space-x-2.mb-1');
    if (statsContainer) {
      const separator = document.createElement('span');
      separator.textContent = '•';
      separator.className = 'text-som-dark som-individual-project-separator';
      statsContainer.appendChild(separator);
      statsContainer.appendChild(projectBadge);
    } else {
      const titleElement = document.querySelector('h1[class*="text-2xl"]');
      if (titleElement && titleElement.parentNode) {
        const badgeContainer = document.createElement('div');
        badgeContainer.className = 'mt-2 mb-2 som-individual-project-ai-badge';
        badgeContainer.appendChild(projectBadge);
        titleElement.parentNode.insertBefore(badgeContainer, titleElement.nextSibling);
      }
    }
}

async function analyzeIndividualDevlogs() {
  try {
    const devlogCards = document.querySelectorAll('[data-viewable-type="Devlog"]');
    for (const devlogCard of devlogCards) {
      try {
        if (devlogCard.hasAttribute('data-som-individual-analyzed')) {
          continue;
        }
        
        devlogCard.setAttribute('data-som-individual-analyzed', 'true');
        const analysis = await DevlogAIAnalyzer.analyzeDevlogElement(devlogCard);
        
        if (analysis) {
          const badge = DevlogAIAnalyzer.displayDevlogAIBadge(devlogCard, analysis);
          const devlogHeader = devlogCard.querySelector('.flex.items-center.justify-between.mb-2');
          if (devlogHeader && badge) {
            const badgeContainer = document.createElement('div');
            badgeContainer.className = 'ml-2';
            badgeContainer.appendChild(badge);
            devlogHeader.appendChild(badgeContainer);
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error('SOM Utils: Error analyzing individual devlog:', error);
      }
    }
  } catch (error) {
    console.error('SOM Utils: Error in analyzeIndividualDevlogs:', error);
  }
}

function createEnhancedTimeEstimate(shellCost, currentShells, totalHours, hoursNeeded) {
  const shellsNeeded = Math.max(0, shellCost - currentShells);
  const progressPercentage = Math.min(100, (currentShells / shellCost) * 100);
  
  let affordabilityClass = 'far';
  if (shellsNeeded === 0) {
    affordabilityClass = 'affordable';
  } else if (hoursNeeded <= 12) {
    affordabilityClass = 'close';
  }
  
  const container = document.createElement('div');
  container.className = 'som-utils-enhanced-estimate';
  
  if (shellsNeeded === 0) {
    container.innerHTML = `
      <div class="som-affordable-estimate" role="region" aria-label="Time estimate">
        <div class="som-affordable-text">
          <span class="som-time-icon" aria-hidden="true">⏱️</span>
          <span class="som-affordable-total">${formatTimeDisplay(totalHours)} at your pace</span>
        </div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="som-progress-container" role="region" aria-label="Shell progress and time estimate">
        <div class="som-shell-progress">
          <img src="/shell.png" class="w-3 h-3" alt="shell" loading="lazy">
          <div class="som-progress-bar" role="progressbar" aria-valuenow="${currentShells}" aria-valuemin="0" aria-valuemax="${shellCost}" aria-label="Shell progress: ${currentShells} out of ${shellCost} shells">
            <div class="som-progress-fill ${affordabilityClass}" style="width: ${progressPercentage}%"></div>
          </div>
          <span class="som-shell-fraction ${affordabilityClass}" aria-label="${currentShells} shells owned out of ${shellCost} required">${currentShells}/${shellCost}</span>
        </div>
        <div class="som-time-estimates">
          <div class="som-time-row">
            <div class="som-time-content">
              <span class="som-time-icon" aria-hidden="true">⏱️</span>
              <span class="som-time-total">Total: ${formatTimeDisplay(totalHours)} at your pace</span>
            </div>
          </div>
          <div class="som-time-row">
            <div class="som-time-content">
              <span class="som-time-icon" aria-hidden="true">⏳</span>
              <span class="som-time-needed ${affordabilityClass}">Need: ${formatTimeDisplay(hoursNeeded)} more</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  return container;
}

function formatTimeDisplay(hours) {
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes}min`;
  } else {
    return `${hours.toFixed(1)}h`;
  }
}

function updateShopTimeEstimate(card) {
  
  if (card.querySelector('.som-utils-enhanced-estimate')) {
    return;
  }
  
  const averageEfficiency = getUserAverageEfficiency();

  if (!averageEfficiency) {
    return;
  }
  
  const shellCostElement = card.querySelector('.absolute.top-2.right-2');

  if (!shellCostElement) return;
  
  const shellCostText = shellCostElement.textContent.trim();
  const shellCostMatch = shellCostText.match(/(\d+)/);
  if (!shellCostMatch) return;
  
  const shellCost = parseInt(shellCostMatch[1]);
  const currentShells = getCurrentUserShells();
  const shellsNeeded = Math.max(0, shellCost - currentShells);
  const totalHours = shellCost / averageEfficiency;
  const hoursNeeded = shellsNeeded / averageEfficiency;
  
  
  const timeEstimateElement = card.querySelector('.text-xs.text-gray-500.text-center');
  if (timeEstimateElement && timeEstimateElement.textContent.includes('hours on an average project')) {
    const enhancedEstimate = createEnhancedTimeEstimate(shellCost, currentShells, totalHours, hoursNeeded);
    
    timeEstimateElement.parentNode.replaceChild(enhancedEstimate, timeEstimateElement);
  }
}

function updateBlackMarketTimeEstimate(shopItemRow) {
  
  if (shopItemRow.querySelector('.som-utils-enhanced-estimate')) {
    return;
  }
  
  const averageEfficiency = getUserAverageEfficiency();
  if (!averageEfficiency) {
    return;
  }
  
  const itemData = extractBlackMarketItemData(shopItemRow);
  if (!itemData.shellCost || itemData.shellCost <= 0) {
    return;
  }
  
  const currentShells = getCurrentUserShells();
  const shellsNeeded = Math.max(0, itemData.shellCost - currentShells);
  const totalHours = itemData.shellCost / averageEfficiency;
  const hoursNeeded = shellsNeeded / averageEfficiency;

  const enhancedEstimate = createEnhancedTimeEstimate(itemData.shellCost, currentShells, totalHours, hoursNeeded);
  
  const actionsElement = shopItemRow.querySelector('.shop-item-actions');
  if (actionsElement) {
    actionsElement.parentNode.insertBefore(enhancedEstimate, actionsElement.nextSibling);
  }
}

function getGoalsData() {
  const data = localStorage.getItem('som-utils-goals');
  if (!data) {
    return {
      goals: [],
      totalShellsNeeded: 0,
      settings: {
        showCompleted: true,
        sortBy: 'priority'
      }
    };
  }
  
  const parsedData = JSON.parse(data);
  
  
  if (parsedData.goals) {
    parsedData.goals = parsedData.goals.map(goal => {
      if (goal.quantity === undefined) {
        return { ...goal, quantity: 1 };
      }
      return goal;
    });
  }
  
  return parsedData;
}

function saveGoalsData(data) {
  localStorage.setItem('som-utils-goals', JSON.stringify(data));
  console.log('SOM Utils: Saved goals data:', data);
}

function getBlackMarketItemPrice(itemId) {
  const data = localStorage.getItem('som-utils-black-market-prices');
  if (!data) return 0;
  
  try {
    const prices = JSON.parse(data);
    return prices[itemId] || 0;
  } catch (e) {
    return 0;
  }
}

function saveBlackMarketItemPrice(itemId, price) {
  if (!itemId || price <= 0) return;
  
  const data = localStorage.getItem('som-utils-black-market-prices') || '{}';
  
  try {
    const prices = JSON.parse(data);
    prices[itemId] = price;
    localStorage.setItem('som-utils-black-market-prices', JSON.stringify(prices));
  } catch (e) {
    console.warn('SOM Utils: Failed to save black market price:', e);
  }
}

function addGoalItem(itemData, quantity = 1) {
  if (!itemData || !itemData.id || !itemData.name || !itemData.shellCost) {
    console.warn('SOM Utils: Invalid item data provided to addGoalItem', itemData);
    return false;
  }
  
  if (quantity < 1 || quantity > 99 || !Number.isInteger(quantity)) {
    console.warn('SOM Utils: Invalid quantity provided to addGoalItem', quantity);
    return false;
  }
  
  const goalsData = getGoalsData();
  
  const existingGoalIndex = goalsData.goals.findIndex(goal => goal.id === itemData.id);
  if (existingGoalIndex !== -1) {
    
    const newQuantity = goalsData.goals[existingGoalIndex].quantity + quantity;
    if (newQuantity > 99) {
      console.warn('SOM Utils: Cannot add goal - would exceed maximum quantity of 99');
      return false;
    }
    goalsData.goals[existingGoalIndex].quantity = newQuantity;
    
    goalsData.totalShellsNeeded = goalsData.goals.reduce((sum, goal) => sum + (goal.shellCost * goal.quantity), 0);
    saveGoalsData(goalsData);
    return true;
  }
  
  const newGoal = {
    id: itemData.id,
    name: itemData.name,
    shellCost: itemData.shellCost,
    imageUrl: itemData.imageUrl || '',
    quantity: quantity,
    addedAt: Date.now(),
    priority: goalsData.goals.length + 1
  };
  
  goalsData.goals.push(newGoal);
  goalsData.totalShellsNeeded = goalsData.goals.reduce((sum, goal) => sum + (goal.shellCost * goal.quantity), 0);
  
  saveGoalsData(goalsData);
  return true;
}

function removeGoalItem(itemId, quantity = 1) {
  
  if (!itemId || typeof itemId !== 'string') {
    console.warn('SOM Utils: Invalid item ID provided to removeGoalItem', itemId);
    return false;
  }
  
  if (quantity < 1 || quantity > 99 || !Number.isInteger(quantity)) {
    console.warn('SOM Utils: Invalid quantity provided to removeGoalItem', quantity);
    return false;
  }
  
  const goalsData = getGoalsData();
  const goalIndex = goalsData.goals.findIndex(goal => goal.id === itemId);
  
  if (goalIndex === -1) {
    console.warn('SOM Utils: Goal not found for removal', itemId);
    return false;
  }
  
  const goal = goalsData.goals[goalIndex];
  
  if (quantity >= goal.quantity) {
    
    goalsData.goals.splice(goalIndex, 1);
  } else {
    
    goalsData.goals[goalIndex].quantity -= quantity;
  }
  
  
  goalsData.goals.forEach((goal, index) => {
    goal.priority = index + 1;
  });
  
  
  goalsData.totalShellsNeeded = goalsData.goals.reduce((sum, goal) => sum + (goal.shellCost * goal.quantity), 0);
  
  saveGoalsData(goalsData);
  return true;
}

function isItemInGoals(itemId) {
  const goalsData = getGoalsData();
  return goalsData.goals.some(goal => goal.id === itemId);
}

function calculateGoalProgress(useProjected = true) {
  const goalsData = getGoalsData();
  const currentShells = getCurrentUserShells();
  const estShells = getCurrentUserShells(true);
  const activeShells = useProjected ? estShells : currentShells;
  
  if (goalsData.goals.length === 0) {
    return {
      currentShells: currentShells,
      estShells: estShells,
      activeShells: activeShells,
      totalNeeded: 0,
      percentage: 100,
      shellsRemaining: 0,
      goals: [],
      useProjected: useProjected
    };
  }
  
  const totalNeeded = goalsData.totalShellsNeeded;
  const percentage = totalNeeded > 0 ? Math.min(100, (activeShells / totalNeeded) * 100) : 100;
  const shellsRemaining = Math.max(0, totalNeeded - activeShells);
  
  const goalsWithProgress = goalsData.goals
    .map(goal => {
      const totalCost = goal.shellCost * goal.quantity;
      const progress = Math.min(100, (activeShells / totalCost) * 100);
      const canAfford = activeShells >= totalCost;
      return {
        ...goal,
        totalCost: totalCost,
        progress: progress,
        canAfford: canAfford
      };
    })
    .sort((a, b) => a.totalCost - b.totalCost);
  
  return {
    currentShells: currentShells,
    estShells: estShells,
    activeShells: activeShells,
    totalNeeded: totalNeeded,
    percentage: percentage,
    shellsRemaining: shellsRemaining,
    goals: goalsWithProgress,
    useProjected: useProjected
  };
}

function extractItemDataFromCard(card) {
  const nameElement = card.querySelector('h3') || card.querySelector('.font-bold') || card.querySelector('[class*="text-lg"]');
  const name = nameElement ? nameElement.textContent.trim() : 'Unknown Item';
  
  const shellCostElement = card.querySelector('.absolute.top-2.right-2');
  let shellCost = 0;
  if (shellCostElement) {
    const costMatch = shellCostElement.textContent.match(/(\d+)/);
    shellCost = costMatch ? parseInt(costMatch[1]) : 0;
  }
  
  const imgElement = card.querySelector('img.rounded-lg.w-full.h-auto.object-scale-down.aspect-square.max-h-48');
  const imageUrl = imgElement ? imgElement.src : '';
  
  
  const id = `${name.toLowerCase().replace(/\s+/g, '-')}-${shellCost}`;
  
  return {
    id: id,
    name: name,
    shellCost: shellCost,
    imageUrl: imageUrl
  };
}

function extractBlackMarketItemData(shopItemRow) {
  const nameElement = shopItemRow.querySelector('.shop-item-title');
  const name = nameElement ? nameElement.textContent.trim() : 'Unknown Item';
  
  const imgElement = shopItemRow.querySelector('.shop-item-image img');
  const imageUrl = imgElement ? imgElement.src : '';
  
  let shellCost = 0;
  const buttonElement = shopItemRow.querySelector('.shop-item-actions button');
  if (buttonElement) {
    const buttonText = buttonElement.textContent.trim();
    
    let costMatch = buttonText.match(/Buy for\s*(\d+)/i);
    if (costMatch) {
      shellCost = parseInt(costMatch[1]);
    } else {
      costMatch = buttonText.match(/(\d+)\s*needed/i);
      if (costMatch) {
        const needed = parseInt(costMatch[1]);
        const currentShells = getCurrentUserShells();
        shellCost = needed + currentShells;
      }
    }
  }
  
  const baseId = `bm-${name.toLowerCase().replace(/\s+/g, '-')}`;
    
  if (shellCost === 0) {
    const storedPrice = getBlackMarketItemPrice(baseId);
    if (storedPrice > 0) {
      shellCost = storedPrice;
    }
  } else {
    saveBlackMarketItemPrice(baseId, shellCost);
  }
  
  const id = `${baseId}-${shellCost}`;
  
  return {
    id: id,
    name: name,
    shellCost: shellCost,
    imageUrl: imageUrl
  };
}

function createGoalButton(itemData, isInGoals = false, currentQuantity = 1) {
  
  if (!itemData || !itemData.id || !itemData.name) {
    console.warn('SOM Utils: Invalid item data provided to createGoalButton', itemData);
    return document.createElement('div'); 
  }
  
  
  currentQuantity = Math.max(1, Math.min(99, Math.floor(currentQuantity || 1)));
  
  const container = document.createElement('div');
  container.className = 'som-goal-button-container';
  
  const button = document.createElement('button');
  button.className = `som-goal-button ${isInGoals ? 'som-goal-added' : 'som-goal-add'}`;
  button.setAttribute('data-item-id', itemData.id);
  button.setAttribute('data-quantity', currentQuantity);
  button.setAttribute('aria-label', isInGoals ? `Remove ${itemData.name} from goals` : `Add ${itemData.name} to goals`);
  
  if (isInGoals) {
    button.innerHTML = `
      <span class="som-goal-icon">✅</span>
      <span class="som-goal-text">In Goals</span>
      ${currentQuantity > 1 ? `<span class="som-goal-quantity">${currentQuantity}x</span>` : ''}
    `;
  } else {
    button.innerHTML = `
      <span class="som-goal-icon">🎯</span>
      <span class="som-goal-text">Add Goal</span>
    `;
  }
  
  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const selectedQuantity = parseInt(button.getAttribute('data-quantity')) || 1;
    toggleGoal(itemData, button, selectedQuantity);
  });
  
  
  if (!isInGoals) {
    const quantitySelector = document.createElement('div');
    quantitySelector.className = 'som-goal-quantity-selector';
    quantitySelector.innerHTML = `
      <button class="som-quantity-btn som-quantity-decrease" aria-label="Decrease quantity">-</button>
      <input type="number" class="som-quantity-input" value="${currentQuantity}" min="1" max="99" aria-label="Quantity">
      <button class="som-quantity-btn som-quantity-increase" aria-label="Increase quantity">+</button>
    `;
    
    const decreaseBtn = quantitySelector.querySelector('.som-quantity-decrease');
    const increaseBtn = quantitySelector.querySelector('.som-quantity-increase');
    const input = quantitySelector.querySelector('.som-quantity-input');
    
    
    const updateQuantity = (newQuantity) => {
      newQuantity = Math.max(1, Math.min(99, Math.floor(newQuantity || 1)));
      currentQuantity = newQuantity;
      input.value = newQuantity;
      button.setAttribute('data-quantity', newQuantity);
    };
    
    decreaseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      updateQuantity(currentQuantity - 1);
    });
    
    increaseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      updateQuantity(currentQuantity + 1);
    });
    
    input.addEventListener('input', (e) => {
      e.stopPropagation();
      const value = parseInt(e.target.value);
      if (!isNaN(value)) {
        updateQuantity(value);
      }
    });
    
    input.addEventListener('blur', (e) => {
      
      updateQuantity(parseInt(e.target.value) || 1);
    });
    
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        updateQuantity(parseInt(e.target.value) || 1);
        button.click(); 
      }
    });
    
    container.appendChild(quantitySelector);
  }
  
  container.appendChild(button);
  
  return container;
}

function toggleGoal(itemData, buttonElement, quantity = 1) {
  const isCurrentlyInGoals = isItemInGoals(itemData.id);
  
  if (isCurrentlyInGoals) {
    if (removeGoalItem(itemData.id, quantity)) {
      updateGoalButtonState(buttonElement, itemData, false);
      updateGoalsProgressHeader();
    }
  } else {
    
    if (addGoalItem(itemData, quantity)) {
      updateGoalButtonState(buttonElement, itemData, true);
      updateGoalsProgressHeader();
    }
  }
}

function updateGoalButtonState(buttonElement, itemData, isInGoals) {
  
  const container = buttonElement.closest('.som-goal-button-container');
  
  
  let quantity = 1;
  if (isInGoals) {
    const goalsData = getGoalsData();
    const existingGoal = goalsData.goals.find(goal => goal.id === itemData.id);
    quantity = existingGoal ? existingGoal.quantity : 1;
  } else {
    
    quantity = parseInt(buttonElement.getAttribute('data-quantity')) || 1;
  }
  
  buttonElement.className = `som-goal-button ${isInGoals ? 'som-goal-added' : 'som-goal-add'}`;
  buttonElement.setAttribute('aria-label', isInGoals ? `Remove ${itemData.name} from goals` : `Add ${itemData.name} to goals`);
  
  buttonElement.setAttribute('data-quantity', quantity);
  
  if (isInGoals) {
    buttonElement.innerHTML = `
      <span class="som-goal-icon">✅</span>
      <span class="som-goal-text">In Goals</span>
      ${quantity > 1 ? `<span class="som-goal-quantity">${quantity}x</span>` : ''}
    `;
  } else {
    buttonElement.innerHTML = `
      <span class="som-goal-icon">🎯</span>
      <span class="som-goal-text">Add Goal</span>
    `;
  }
  
  
  if (container) {
    const quantitySelector = container.querySelector('.som-goal-quantity-selector');
    
    if (isInGoals && quantitySelector) {
      
      quantitySelector.remove();
    } else if (!isInGoals && !quantitySelector) {
      
      const newQuantitySelector = document.createElement('div');
      newQuantitySelector.className = 'som-goal-quantity-selector';
      newQuantitySelector.innerHTML = `
        <button class="som-quantity-btn som-quantity-decrease" aria-label="Decrease quantity">-</button>
        <input type="number" class="som-quantity-input" value="${quantity}" min="1" max="99" aria-label="Quantity">
        <button class="som-quantity-btn som-quantity-increase" aria-label="Increase quantity">+</button>
      `;
      
      const decreaseBtn = newQuantitySelector.querySelector('.som-quantity-decrease');
      const increaseBtn = newQuantitySelector.querySelector('.som-quantity-increase');
      const input = newQuantitySelector.querySelector('.som-quantity-input');
      
      let currentQuantity = quantity;
      
      const updateQuantity = (newQuantity) => {
        newQuantity = Math.max(1, Math.min(99, Math.floor(newQuantity || 1)));
        currentQuantity = newQuantity;
        input.value = newQuantity;
        buttonElement.setAttribute('data-quantity', newQuantity);
      };
      
      decreaseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        updateQuantity(currentQuantity - 1);
      });
      
      increaseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        updateQuantity(currentQuantity + 1);
      });
      
      input.addEventListener('input', (e) => {
        e.stopPropagation();
        const value = parseInt(e.target.value);
        if (!isNaN(value)) {
          updateQuantity(value);
        }
      });
      
      input.addEventListener('blur', (e) => {
        updateQuantity(parseInt(e.target.value) || 1);
      });
      
      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          updateQuantity(parseInt(e.target.value) || 1);
          buttonElement.click(); 
        }
      });
      container.insertBefore(newQuantitySelector, buttonElement);
    }
  }
}

function createAdvancedStatsAccordion(itemData, currentShells, averageEfficiency) {
  const shellsNeeded = Math.max(0, itemData.shellCost - currentShells);
  const progressPercentage = Math.min(100, (currentShells / itemData.shellCost) * 100);
  
  const baseEfficiencies = [5, 10, 15, 20, 25];
  const presetEfficiencies = averageEfficiency ? 
    [...baseEfficiencies, Math.round(averageEfficiency)].filter((v, i, arr) => arr.indexOf(v) === i).sort((a, b) => a - b).slice(0, 6) :
    baseEfficiencies;
  
  const accordion = document.createElement('div');
  accordion.className = 'som-stats-accordion';
  
  const accordionId = `accordion-${itemData.id}`;
  
  accordion.innerHTML = `
    <button class="som-stats-toggle" aria-expanded="false" aria-controls="${accordionId}" type="button">
      <div class="som-toggle-content">
        <div class="som-toggle-left">
          <span class="som-toggle-icon">📊</span>
          <span class="som-toggle-text">Advanced Stats</span>
        </div>
        <div class="som-toggle-right">
          ${averageEfficiency ? `<span class="som-toggle-summary">${averageEfficiency.toFixed(1)}/hr avg</span>` : ''}
          <span class="som-toggle-arrow">▼</span>
        </div>
      </div>
    </button>
    <div class="som-stats-content" id="${accordionId}" aria-hidden="true">
      <div class="som-stats-card">
        <div class="som-card-body">
          <div class="som-progress-visual">
            <div class="som-progress-circle">
              <svg class="som-circle-svg" width="50" height="50" viewBox="0 0 50 50">
                <circle cx="25" cy="25" r="20" fill="none" stroke="rgba(156, 163, 175, 0.2)" stroke-width="4"/>
                <circle cx="25" cy="25" r="20" fill="none" stroke="#059669" stroke-width="4" 
                        stroke-dasharray="${2 * Math.PI * 20}" 
                        stroke-dashoffset="${2 * Math.PI * 20 * (1 - progressPercentage / 100)}"
                        stroke-linecap="round"/>
              </svg>
              <div class="som-circle-text">${progressPercentage.toFixed(0)}%</div>
            </div>
            <div class="som-progress-details">
              <div class="som-detail-item">
                <span class="som-detail-value">${currentShells}</span>
                <span class="som-detail-label">owned</span>
              </div>
              <span class="som-detail-separator">/</span>
              <div class="som-detail-item">
                <span class="som-detail-value">${itemData.shellCost}</span>
                <span class="som-detail-label">needed</span>
              </div>
            </div>
          </div>
          
          <div class="som-efficiency-grid">
            ${presetEfficiencies.map(efficiency => {
              const totalTime = itemData.shellCost / efficiency;
              const isUserRate = averageEfficiency && Math.abs(efficiency - averageEfficiency) < 0.5;
              const isFastRate = efficiency >= 20;
              const isSlowRate = efficiency <= 5;
              
              let additionalClass = '';
              if (isUserRate) additionalClass = 'som-user-rate';
              else if (isFastRate) additionalClass = 'som-fast-rate';
              else if (isSlowRate) additionalClass = 'som-slow-rate';
              
              return `
                <div class="som-efficiency-item ${additionalClass}">
                  <div class="som-efficiency-header">
                    <span class="som-efficiency-rate">${efficiency}</span>
                    <span class="som-efficiency-unit">s/h</span>
                    ${isUserRate ? '<span class="som-user-badge">YOU</span>' : ''}
                  </div>
                  <div class="som-time-item">
                    <span class="som-time-value">${formatTimeDisplay(totalTime)}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
          
          <div class="som-calculator-container">
            <div class="som-input-wrapper">
              <input 
                type="range" 
                id="efficiency-slider-${itemData.id}"
                class="som-efficiency-slider" 
                min="1" 
                max="30" 
                step="0.5" 
                value="15"
                aria-label="Efficiency rate in shells per hour">
              <span class="som-slider-value" id="slider-value-${itemData.id}">15</span>
              <span class="som-input-unit">s/h</span>
            </div>
            <div class="som-calculator-result">
              <div class="som-result-grid">
                <div class="som-result-item">
                  <span class="som-result-icon">⏳</span>
                  <span class="som-result-value som-result-needed">-</span>
                </div>
                <div class="som-result-item">
                  <span class="som-result-icon">⏱️</span>
                  <span class="som-result-value som-result-total">-</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  
  const toggle = accordion.querySelector('.som-stats-toggle');
  const content = accordion.querySelector('.som-stats-content');
  const slider = accordion.querySelector('.som-efficiency-slider');
  const sliderValue = accordion.querySelector('.som-slider-value');
  const result = accordion.querySelector('.som-calculator-result');
  const arrow = accordion.querySelector('.som-toggle-arrow');
  
  toggle.addEventListener('click', () => {
    const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', !isExpanded);
    content.setAttribute('aria-hidden', isExpanded);
    
    if (arrow) {
      arrow.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(180deg)';
    }
    
    if (isExpanded) {
      content.style.display = 'none';
    } else {
      content.style.display = 'block';
    }
  });
  
  const updateCalculator = (rate) => {
    const customRate = parseFloat(rate);
    if (customRate && customRate >= 1 && customRate <= 30) {
      const timeNeeded = shellsNeeded / customRate;
      const totalTime = itemData.shellCost / customRate;
      
      if (sliderValue) {
        sliderValue.textContent = customRate;
      }
      
      result.querySelector('.som-result-needed').textContent = formatTimeDisplay(timeNeeded);
      result.querySelector('.som-result-total').textContent = formatTimeDisplay(totalTime);
    } else {
      result.querySelector('.som-result-needed').textContent = '-';
      result.querySelector('.som-result-total').textContent = '-';
    }
  };

  if (slider) {
    slider.addEventListener('input', (e) => {
      updateCalculator(e.target.value);
    });
    
    
    updateCalculator(slider.value);
  }
  
  return accordion;
}

function addGoalButton(card) {
  
  if (card.querySelector('.som-goal-button-container')) {
    return;
  }
  
  const itemData = extractItemDataFromCard(card);
  if (!itemData.shellCost || itemData.shellCost <= 0) {
    return;
  }
  
  
  const goalsData = getGoalsData();
  const existingGoal = goalsData.goals.find(goal => goal.id === itemData.id);
  const currentQuantity = existingGoal ? existingGoal.quantity : 1;
  
  const isInGoals = isItemInGoals(itemData.id);
  const goalButtonContainer = createGoalButton(itemData, isInGoals, currentQuantity);
  
  const currentShells = getCurrentUserShells();
  const averageEfficiency = getUserAverageEfficiency();
  const accordion = createAdvancedStatsAccordion(itemData, currentShells, averageEfficiency);
  
  const enhancedEstimate = card.querySelector('.som-utils-enhanced-estimate');
  if (enhancedEstimate) {
    const progressContainer = enhancedEstimate.querySelector('.som-progress-container');
    
    if (progressContainer) {
      const lastTimeRow = progressContainer.querySelector('.som-time-estimates .som-time-row:last-child');
      if (lastTimeRow) {
        lastTimeRow.appendChild(goalButtonContainer);
      } else {
        enhancedEstimate.appendChild(goalButtonContainer);
      }
    } else {
      enhancedEstimate.appendChild(goalButtonContainer);
    }
    
    enhancedEstimate.parentNode.insertBefore(accordion, enhancedEstimate.nextSibling);
  } else {
    const cardBody = card.querySelector('div') || card;
    cardBody.appendChild(goalButtonContainer);
    cardBody.appendChild(accordion);
  }
}

function addBlackMarketGoalButton(shopItemRow) {
  
  if (shopItemRow.querySelector('.som-goal-button-container')) {
    return;
  }
  
  const itemData = extractBlackMarketItemData(shopItemRow);
  if (!itemData.shellCost || itemData.shellCost <= 0) {
    return;
  }
  
  const goalsData = getGoalsData();
  const existingGoal = goalsData.goals.find(goal => goal.id === itemData.id);
  const currentQuantity = existingGoal ? existingGoal.quantity : 1;
  
  const isInGoals = isItemInGoals(itemData.id);
  const goalButtonContainer = createGoalButton(itemData, isInGoals, currentQuantity);
  
  const currentShells = getCurrentUserShells();
  const averageEfficiency = getUserAverageEfficiency();
  const accordion = createAdvancedStatsAccordion(itemData, currentShells, averageEfficiency);
  
  const enhancedEstimate = shopItemRow.querySelector('.som-utils-enhanced-estimate');
  if (enhancedEstimate) {
    const progressContainer = enhancedEstimate.querySelector('.som-progress-container');
    
    if (progressContainer) {
      const lastTimeRow = progressContainer.querySelector('.som-time-estimates .som-time-row:last-child');
      if (lastTimeRow) {
        lastTimeRow.appendChild(goalButtonContainer);
      } else {
        enhancedEstimate.appendChild(goalButtonContainer);
      }
    } else {
      enhancedEstimate.appendChild(goalButtonContainer);
    }
    
    enhancedEstimate.parentNode.insertBefore(accordion, enhancedEstimate.nextSibling);
  } else {
    const actionsElement = shopItemRow.querySelector('.shop-item-actions');
    const detailsElement = shopItemRow.querySelector('.shop-item-details');
    if (actionsElement && detailsElement) {
      actionsElement.appendChild(goalButtonContainer);
      detailsElement.parentNode.insertBefore(accordion, detailsElement.nextSibling);
    }
  }
}

function createGoalsProgressHeader() {
  const progressData = calculateGoalProgress(window.somUtilsProjectionMode);
  
  if (progressData.goals.length === 0) {
    return null;
  }
  
  const header = document.createElement('div');
  header.className = 'som-goals-progress-header';
  header.setAttribute('role', 'region');
  header.setAttribute('aria-label', 'Goals progress tracker');
  
  let averageEfficiency = getUserAverageEfficiency();
  if (!averageEfficiency) {
    averageEfficiency = 10;
  }
  const hoursRemaining = averageEfficiency ? progressData.shellsRemaining / averageEfficiency : 0;
  
  header.innerHTML = `
    <div class="som-goals-header-content">
      <div class="som-goals-title">
        <h3 class="som-goals-heading">Your Goals Progress</h3>
        <span class="som-goals-count">(${progressData.goals.length})</span>
        <div class="som-projection-toggle">
          <button class="som-toggle-btn ${!progressData.useProjected ? 'active' : ''}" data-mode="actual">Actual</button>
          <button class="som-toggle-btn ${progressData.useProjected ? 'active' : ''}" data-mode="projected">Projected</button>
        </div>
      </div>
      <div class="som-goals-progress-container">
        <div class="som-goals-progress-bar" role="progressbar" aria-valuenow="${progressData.activeShells}" aria-valuemin="0" aria-valuemax="${progressData.totalNeeded}" aria-label="Goals progress: ${progressData.activeShells} out of ${progressData.totalNeeded} shells">
          ${createGoalMarkers(progressData.goals, progressData.totalNeeded, progressData.activeShells)}
        </div>
        <div class="som-goals-stats">
          <div class="som-goals-stat-item">
            <span class="som-goals-stat-value">${Math.round(progressData.activeShells)} / ${progressData.totalNeeded}</span>
            <span class="som-goals-stat-label">shells (${progressData.useProjected ? 'projected' : 'actual'})</span>
          </div>
          <div class="som-goals-stat-item">
            <span class="som-goals-stat-value">${progressData.percentage.toFixed(1)}%</span>
            <span class="som-goals-stat-label">complete</span>
          </div>
          ${averageEfficiency && hoursRemaining > 0 ? `
            <div class="som-goals-stat-item">
              <span class="som-goals-stat-value">${formatTimeDisplay(hoursRemaining)}</span>
              <span class="som-goals-stat-label">remaining</span>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
  
  header.addEventListener('click', (e) => {
    if (e.target.classList.contains('som-toggle-btn')) {
      const mode = e.target.dataset.mode;
      const newProjectedMode = mode === 'projected';
      
      if (newProjectedMode !== window.somUtilsProjectionMode) {
        window.somUtilsProjectionMode = newProjectedMode;
        updateGoalsProgressHeader();
      }
    }
  });
  
  return header;
}

function createGoalMarkers(goals, totalShells, currentShells) {
  
  const maxShellCost = goals.length > 0 ? Math.max(...goals.map(goal => goal.shellCost * goal.quantity)) : 0;

  
  const progressPercentage = totalShells > 0 ? Math.min(100, (currentShells / totalShells) * 100) : 0;
  
  
  const markers = goals.map((goal) => {
    const totalCost = goal.shellCost * goal.quantity;
    const position = maxShellCost > 0 ? (totalCost / maxShellCost) * 100 : 0;
    
    return `
      <div class="som-goal-marker ${goal.canAfford ? 'som-goal-completed' : ''}"
           style="left: ${position}%"
           data-goal-id="${goal.id}"
           title="${goal.name} (${goal.quantity}x ${goal.shellCost} shells = ${totalCost} shells)"
           aria-label="Goal: ${goal.name}, ${goal.quantity}x ${goal.shellCost} shells, total ${totalCost} shells, ${goal.canAfford ? 'completed' : 'in progress'}">
        <div class="som-goal-marker-circle">
          ${goal.imageUrl ? `<img src="${goal.imageUrl}" alt="${goal.name}" class="som-goal-marker-image" loading="lazy">` : `<span class="som-goal-marker-fallback">🎯</span>`}
        </div>
        <button class="som-goal-remove-btn" aria-label="Remove ${goal.name} from goals" title="Remove goal">×</button>
        ${goal.quantity > 1 ? `<div class="som-goal-quantity-badge">${goal.quantity}x</div>` : ''}
      </div>
    `;
  }).join('');
  
  const progressFill = `<div class="som-goals-progress-fill" style="width: ${progressPercentage}%"></div>`;
  
  return progressFill + markers;
}

function addGoalsProgressHeader() {
  const existingHeader = document.querySelector('.som-goals-progress-header');
  if (existingHeader) {
    existingHeader.remove();
  }
  
  const progressHeader = createGoalsProgressHeader();
  if (!progressHeader) {
    return;
  }
  
  const shopItemsHeading = document.querySelector('h2, .text-2xl, [class*="text-2xl"]');
  const shopItemsSection = document.querySelector('[class*="grid"], .grid');
  
  if (shopItemsSection) {
    shopItemsSection.parentNode.insertBefore(progressHeader, shopItemsSection);
  } else if (shopItemsHeading) {
    shopItemsHeading.parentNode.insertBefore(progressHeader, shopItemsHeading.nextSibling);
  } else {
    const shopContainer = document.querySelector('main') || document.querySelector('.container') || document.body;
    const shopCards = document.querySelectorAll('.card-with-gradient[data-controller="card"]');
    
    if (shopCards.length > 0) {
      shopCards[0].parentNode.insertBefore(progressHeader, shopCards[0]);
    } else {
      shopContainer.appendChild(progressHeader);
    }
  }
  
  const removeButtons = progressHeader.querySelectorAll('.som-goal-remove-btn');
  removeButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const goalMarker = button.closest('.som-goal-marker');
      const goalId = goalMarker.getAttribute('data-goal-id');
      
      const goalsData = getGoalsData();
      const goal = goalsData.goals.find(g => g.id === goalId);
      const quantityToRemove = goal ? goal.quantity : 99; 
      
      if (goalId && removeGoalItem(goalId, quantityToRemove)) {
        addGoalsProgressHeader();
        updateAllGoalButtons();
      }
    });
  });
}

function updateAllGoalButtons() {
  const shopCards = document.querySelectorAll('.card-with-gradient[data-controller="card"]');
  shopCards.forEach(card => {
    const existingContainer = card.querySelector('.som-goal-button-container');
    const existingAccordion = card.querySelector('.som-stats-accordion');
    if (existingContainer) {
      existingContainer.remove();
      if (existingAccordion) existingAccordion.remove();
      addGoalButton(card);
    }
  });
  
  const blackMarketItems = document.querySelectorAll('.shop-item-row');
  blackMarketItems.forEach(item => {
    const existingContainer = item.querySelector('.som-goal-button-container');
    const existingAccordion = item.querySelector('.som-stats-accordion');
    if (existingContainer) {
      existingContainer.remove();
      if (existingAccordion) existingAccordion.remove();
      addBlackMarketGoalButton(item);
    }
  });
}

function updateGoalsProgressHeader() {
  addGoalsProgressHeader();
}

function processShopPage() {
  const shopCards = document.querySelectorAll('.card-with-gradient[data-controller="card"]');
  addGoalsProgressHeader();
  
  shopCards.forEach(card => {
    updateShopTimeEstimate(card);
    addGoalButton(card);
  });
}

function processBlackMarketPage() {
  const shopItems = document.querySelectorAll('.shop-item-row');
  
  shopItems.forEach(item => {
    updateBlackMarketTimeEstimate(item);
    addBlackMarketGoalButton(item);
  });
}

function addFilePasteSupport() {
  if (document.documentElement.hasAttribute('data-som-paste-initialized')) {
    return;
  }
  
  document.documentElement.setAttribute('data-som-paste-initialized', 'true');
  
  const notification = document.createElement('div');
  notification.className = 'som-paste-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #059669;
    color: white;
    padding: 12px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    z-index: 10000;
    display: none;
    animation: som-slide-down 0.3s ease-out;
  `;
  document.body.appendChild(notification);
  
  function showNotification(message, isError = false) {
    notification.textContent = message;
    notification.style.background = isError ? '#dc2626' : '#059669';
    notification.style.display = 'block';
    
    setTimeout(() => {
      notification.style.display = 'none';
    }, 3000);
  }
  
  function isFileInput(element) {
    return element && element.tagName === 'INPUT' && element.type === 'file';
  }
  
  function getTargetFileInput(target) {
    if (isFileInput(target)) {
      return target;
    }
    
    if (isFileInput(document.activeElement)) {
      return document.activeElement;
    }
    
    const devlogInput = document.querySelector('input#devlog_file, input[name="devlog[file]"]');
    if (devlogInput) {
      return devlogInput;
    }
    
    
    let current = target;
    while (current && current !== document.body) {
      const fileInput = current.querySelector?.('input[type="file"]');
      if (fileInput) {
        return fileInput;
      }
      current = current.parentElement;
    }
    
    
    const fileInputs = document.querySelectorAll('input[type="file"]');
    for (const input of fileInputs) {
      const rect = input.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return input; 
      }
    }
    
    return null;
  }
  
  
  document.addEventListener('paste', async (e) => {
    const targetInput = getTargetFileInput(e.target);
    
    if (!targetInput) {
      return; 
    }
    
    
    const clipboardItems = e.clipboardData?.items;
    if (!clipboardItems || clipboardItems.length === 0) {
      showNotification('No files found in clipboard', true);
      return;
    }
    
    const fileItems = Array.from(clipboardItems).filter(item => item.kind === 'file');
    
    if (fileItems.length === 0) {
      showNotification('No files found in clipboard', true);
      return;
    }
    
    e.preventDefault();
    
    try {
      
      const dt = new DataTransfer();
      
      
      for (const item of fileItems) {
        const file = item.getAsFile();
        if (file) {
          console.log('SOM Utils: Processing pasted file:', file.name, file.type, file.size);
          dt.items.add(file);
        }
      }
      
      if (dt.files.length > 0) {
        targetInput.files = dt.files;
        
        const changeEvent = new Event('change', { bubbles: true });
        const inputEvent = new Event('input', { bubbles: true });
        
        targetInput.dispatchEvent(inputEvent);
        targetInput.dispatchEvent(changeEvent);
        
        const fileName = dt.files.length === 1 ? dt.files[0].name : `${dt.files.length} files`;
        showNotification(`Pasted: ${fileName}`);
        
        console.log('SOM Utils: Successfully pasted files:', Array.from(dt.files).map(f => f.name));
      } else {
        showNotification('Failed to process pasted files', true);
      }
    } catch (error) {
      showNotification('Error pasting files', true);
    }
  });
  
  function enhanceFileInputs() {
    const fileInputs = document.querySelectorAll('input[type="file"]');
    
    fileInputs.forEach(input => {
      if (input.hasAttribute('data-som-enhanced')) {
        return;
      }
      
      input.setAttribute('data-som-enhanced', 'true');
      
      input.addEventListener('focus', () => {
        input.style.outline = '2px solid rgba(5, 150, 105, 0.3)';
        input.style.outlineOffset = '2px';
      });
      
      input.addEventListener('blur', () => {
        input.style.outline = 'none';
      });
      
      
      const container = input.parentElement;
      
      container.addEventListener('dragover', (e) => {
        e.preventDefault();
        input.style.borderColor = '#059669';
        input.style.backgroundColor = 'rgba(5, 150, 105, 0.05)';
      });
      
      container.addEventListener('dragleave', (e) => {
        e.preventDefault();
        if (!container.contains(e.relatedTarget)) {
          input.style.borderColor = '';
          input.style.backgroundColor = '';
        }
      });
      
      container.addEventListener('drop', (e) => {
        e.preventDefault();
        input.style.borderColor = '';
        input.style.backgroundColor = '';
        
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
          const dt = new DataTransfer();
          files.forEach(file => dt.items.add(file));
          input.files = dt.files;
          
          const changeEvent = new Event('change', { bubbles: true });
          input.dispatchEvent(changeEvent);
          
          const fileName = files.length === 1 ? files[0].name : `${files.length} files`;
          showNotification(`Dropped: ${fileName}`);
        }
      });
      
    });
  }
  
  
  enhanceFileInputs();
  
  
  const observer = new MutationObserver(() => {
    enhanceFileInputs();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
}

let lastProcessTime = 0;
let isProcessing = false;

function clearProjectAnalysisMarkers() {
  const analyzedProjects = document.querySelectorAll('[data-som-project-analyzed]');
  analyzedProjects.forEach(project => {
    project.removeAttribute('data-som-project-analyzed');
  });
  
  const analyzedDevlogs = document.querySelectorAll('[data-som-devlog-analyzed]');
  analyzedDevlogs.forEach(devlog => {
    devlog.removeAttribute('data-som-devlog-analyzed');
  });
  
  if (typeof ProjectAIAnalyzer !== 'undefined' && ProjectAIAnalyzer.cache) {
    ProjectAIAnalyzer.cache.clear();
  }
}

function addVoteQualityIndicator() {
  const voteTextarea = document.querySelector('#vote_explanation');
  if (!voteTextarea || voteTextarea.hasAttribute('data-som-quality-added')) {
    return;
  }
  
  voteTextarea.setAttribute('data-som-quality-added', 'true');
  
  const indicator = document.createElement('div');
  indicator.className = 'som-vote-quality-indicator';
  indicator.style.cssText = `
    position: absolute;
    bottom: 12px;
    right: 16px;
    font-size: 0.65rem;
    padding: 2px 6px;
    border-radius: 4px;
    transition: all 0.2s ease;
    pointer-events: none;
    z-index: 10;
    opacity: 0.8;
    font-weight: 500;
  `;
  
  voteTextarea.style.position = 'relative';
  
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    position: relative;
    display: inline-block;
    width: 100%;
  `;
  
  voteTextarea.parentNode.insertBefore(wrapper, voteTextarea);
  wrapper.appendChild(voteTextarea);
  wrapper.appendChild(indicator);
  
  function updateQualityIndicator() {
    const length = voteTextarea.value.length;
    let text, color, bgColor;
    
    if (length < 10) {
      text = length === 0 ? '' : 'slim';
      color = '#8B7355';
      bgColor = 'rgba(139, 115, 85, 0.1)';
    } else if (length < 40) {
      text = 'getting there';
      color = '#A0845C';
      bgColor = 'rgba(160, 132, 92, 0.1)';
    } else if (length < 60) {
      text = 'looking good';
      color = '#6B5B47';
      bgColor = 'rgba(107, 91, 71, 0.1)';
    } else {
      text = 'excellent';
      color = '#5C4E3A';
      bgColor = 'rgba(92, 78, 58, 0.15)';
    }
    
    if (length === 0) {
      indicator.style.display = 'none';
    } else {
      indicator.style.display = 'block';
      indicator.textContent = text ? `${length} • ${text}` : `${length}`;
      indicator.style.color = color;
      indicator.style.backgroundColor = bgColor;
    }
  }
  
  voteTextarea.addEventListener('input', updateQualityIndicator);
  updateQualityIndicator()
}

function addVoteSubmissionHandler() {
  const existingButton = document.querySelector('button[data-som-vote-handler]');
  if (existingButton) {
    return;
  }

  const submitButton = document.querySelector('button[data-form-target="submitButton"]');
  if (submitButton) {
    submitButton.setAttribute('data-som-vote-handler', 'true');
    
    submitButton.addEventListener('click', () => {
      setTimeout(() => {
        clearProjectAnalysisMarkers();
        const project0 = document.querySelector('[data-project-index="0"]');
        const project1 = document.querySelector('[data-project-index="1"]');
        if (project0 && project1) {
          VotingProjectAnalyzer.processDualProjects().catch(error => {
            console.error('SOM Utils: Error reprocessing projects after vote:', error);
          });
          
          processProjectAIAnalysis(project0);
          processProjectAIAnalysis(project1);
        }
      }, 800);
    });
  }
}

async function processProjectAIAnalysis(projectElement) {
  try {
    if (projectElement.getAttribute('data-som-project-analyzed')) {
      return;
    }
    
    
    const analysis = await ProjectAIAnalyzer.analyzeProjectElement(projectElement);
    if (analysis) {
      await ProjectAIAnalyzer.displayProjectAnalysis(projectElement, analysis);
    }
  } catch (error) {
    console.error('SOM Utils: Error in project analysis:', error);
  }
}

function removeSinkingStuff() {
  const sinkeningContainers = document.querySelectorAll('.sinkening-container');
  sinkeningContainers.forEach(container => {
    container.classList.remove('sinkening-container');
  });
  
  const audioElements = document.querySelectorAll('#sinkening-wave-music, audio[id="sinkening-wave-music"]');
  audioElements.forEach(audio => audio.remove());
  
  const waterElements = document.querySelectorAll('.sinkening-water, .sinkening-water-2');
  waterElements.forEach(water => {
    const parentDiv = water.closest('.w-full.overflow-hidden');
    if (parentDiv && parentDiv.children.length <= 2) {
      parentDiv.remove();
    } else {
      water.remove();
    }
  });
  
  const waterContainers = document.querySelectorAll('div.w-full.overflow-hidden');
  waterContainers.forEach(container => {
    const children = Array.from(container.children);
    const hasOnlyWaterChildren = children.length > 0 && children.every(child => 
      child.classList.contains('sinkening-water') || 
      child.classList.contains('sinkening-water-2') ||
      (child.classList.contains('fixed') && child.querySelector('.sinkening-water, .sinkening-water-2'))
    );
    if (hasOnlyWaterChildren && children.length <= 3) {
      container.remove();
    }
  });
}

function processCurrentPage() {
  const currentPath = window.location.pathname;
  const now = Date.now();
  
  if (now - lastProcessTime < 1000 || isProcessing) {
    return;
  }
  
  lastProcessTime = now;
  isProcessing = true;
  
  try {
    const heidimarketLoader = document.querySelector('.loader');
    if (heidimarketLoader && heidimarketLoader.textContent.includes('heidimarket')) {
      heidimarketLoader.classList.add('fade-out');
    }
    
    removeSinkingStuff();
    
    addFilePasteSupport();
    
    displayUserRank();
    
    if (currentPath === '/votes/new') {
      const project0 = document.querySelector('[data-project-index="0"]');
      const project1 = document.querySelector('[data-project-index="1"]');
      
      if (project0 && project1) {
        VotingProjectAnalyzer.processDualProjects().catch(error => {
          console.error('SOM Utils: Error processing both projects:', error);
        });
        
        processProjectAIAnalysis(project0);
        processProjectAIAnalysis(project1);
      }
      addVoteSubmissionHandler();
      addVoteQualityIndicator();
    } else if (currentPath.startsWith('/projects/') && currentPath.match(/\/projects\/\d+/)) {
      processProjectPage();
    } else if (currentPath === '/shop') {
      processShopPage();
    } else if (currentPath === '/shop/black_market') {
      processBlackMarketPage();
    } else {
      processProjectCards();
    }
  } finally {
    isProcessing = false;
  }
}

document.addEventListener('DOMContentLoaded', processCurrentPage);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', processCurrentPage);
} else {
  processCurrentPage();
}

document.addEventListener('turbo:load', processCurrentPage);
document.addEventListener('turbo:render', processCurrentPage);

setInterval(processCurrentPage, 2000);

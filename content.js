function parseTimeString(timeStr) {
  const hourMatch = timeStr.match(/(\d+)h/);
  const minuteMatch = timeStr.match(/(\d+)m/);
  
  const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
  const minutes = minuteMatch ? parseInt(minuteMatch[1]) : 0;
  
  return hours + (minutes / 60);
}

function parseShellsString(shellsText) {
  if (!shellsText || shellsText.includes("To get shells, ship this project!")) {
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
  const data = JSON.parse(localStorage.getItem('som-utils-efficiency') || '{"projects": []}');
  data.projects.push({ shells, hours, timestamp: Date.now() });
  
  if (data.projects.length > 20) {
    data.projects = data.projects.slice(-20);
  }
  
  localStorage.setItem('som-utils-efficiency', JSON.stringify(data));
}

function getUserAverageEfficiency() {
  const data = JSON.parse(localStorage.getItem('som-utils-efficiency') || '{"projects": []}');
  
  if (data.projects.length === 0) return null;
  
  let totalShells = 0;
  let totalHours = 0;
  
  data.projects.forEach(project => {
    totalShells += project.shells;
    totalHours += project.hours;
  });
  
  return totalHours > 0 ? calculateShellsPerHour(totalShells, totalHours) : null;
}

function getCurrentUserShells() {
  const shellImages = document.querySelectorAll('picture.inline-block.w-4.h-4.flex-shrink-0 img[src*="shell"]');
  
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
            return parseFloat(shellMatch[1]);
          }
        }
      }
    }
  }
  return 0;
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


function addShellsPerHourToCard(card) {
  if (card.querySelector('[class*="som-utils"]')) {
    return;
  }
  
  const grayTexts = card.querySelectorAll('p.text-gray-400');
  
  let timeText = '';
  let shellsText = '';
  
  grayTexts.forEach(p => {
    const text = p.textContent.trim();
    if (text.match(/\d+h\s+\d+m/)) {
      timeText = text.split('\n')[0];
    }
    if (text.includes('shells') || text.includes('ship this project')) {
      shellsText = text;
    }
  });
  
  if (!timeText) return;
  
  const hours = parseTimeString(timeText);
  const shells = parseShellsString(shellsText);
  const shellsPerHour = calculateShellsPerHour(shells, hours);
  
  if (shells > 0 && hours > 0) {
    saveUserEfficiency(shells, hours);
  }
  
  let displayElement;
  
  if (hours === 0) {
    displayElement = createSubtleText('⏱️ No time tracked yet');
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

function processProjectCards() {
  const projectCards = document.querySelectorAll('a[href^="/projects/"]');
  
  const actualProjectCards = Array.from(projectCards).filter(card => {
    const hasCreateText = card.textContent.toLowerCase().includes('create project');
    const hasProjectId = card.href.match(/\/projects\/\d+$/);
    return !hasCreateText && hasProjectId;
  });
  
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
}

function extractProjectSortingData(card, index) {
  const grayTexts = card.querySelectorAll('p.text-gray-400');
  
  let timeText = '';
  let shellsText = '';
  let title = '';
  
  const titleElement = card.querySelector('h2, h3, .font-bold, [class*="text-lg"]') || card.querySelector('p:not(.text-gray-400)');
  if (titleElement) {
    title = titleElement.textContent.trim();
  }
  
  grayTexts.forEach(p => {
    const text = p.textContent.trim();
    if (text.match(/\d+h\s+\d+m/)) {
      timeText = text.split('\n')[0];
    }
    if (text.includes('shells') || text.includes('ship this project')) {
      shellsText = text;
    }
  });
  
  if (!timeText) return null;
  
  const hours = parseTimeString(timeText);
  const shells = parseShellsString(shellsText);
  const efficiency = calculateShellsPerHour(shells, hours);
  
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

function parseShipEventData(shipElement) {
  const payoutText = shipElement.textContent;
  const shellsMatch = payoutText.match(/(\d+(?:\.\d+)?)\s*shells/);
  const shells = shellsMatch ? parseFloat(shellsMatch[1]) : 0;
  
  let timeElement = shipElement.parentElement?.querySelector('time');
  if (!timeElement) {
    timeElement = shipElement.closest('div')?.querySelector('time');
  }
  if (!timeElement) {
    const containerText = shipElement.closest('div')?.textContent || '';
    const timeMatch = containerText.match(/(\d+h\s+\d+m)/);
    if (timeMatch) {
      const hours = parseTimeString(timeMatch[1]);
      return { shells, hours };
    }
    return null;
  }
  
  const timeText = timeElement.textContent.trim();
  const hours = parseTimeString(timeText);
  
  return { shells, hours };
}

function addShellsPerHourToShipEvent(shipElement) {
  if (shipElement.querySelector('[class*="som-utils"]')) {
    return;
  }
  
  const shipData = parseShipEventData(shipElement);
  if (!shipData || shipData.hours === 0) return;
  
  const shellsPerHour = calculateShellsPerHour(shipData.shells, shipData.hours);
  if (shellsPerHour <= 0) return;
  
  const metric = document.createElement('span');
  metric.className = 'som-utils-ship-metric';
  metric.innerHTML = `<span class="som-ship-efficiency">${shellsPerHour.toFixed(1)}/hr</span>`;
  
  const targetElement = shipElement.querySelector('span');
  if (targetElement) {
    targetElement.appendChild(metric);
  }
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
        if (text.match(/\d+h\s+\d+m/)) {
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
          <img src="/shell.png" class="w-4 h-4" alt="shell" loading="lazy">
          <div class="som-progress-bar" role="progressbar" aria-valuenow="${currentShells}" aria-valuemin="0" aria-valuemax="${shellCost}" aria-label="Shell progress: ${currentShells} out of ${shellCost} shells">
            <div class="som-progress-fill ${affordabilityClass}" style="width: ${progressPercentage}%"></div>
          </div>
          <span class="som-shell-fraction ${affordabilityClass}" aria-label="${currentShells} shells owned out of ${shellCost} required">${currentShells}/${shellCost}</span>
        </div>
        <div class="som-time-estimates">
          <div class="som-time-row">
            <span class="som-time-icon" aria-hidden="true">⏱️</span>
            <span class="som-time-total">Total: ${formatTimeDisplay(totalHours)} at your pace</span>
          </div>
          <div class="som-time-row">
            <span class="som-time-icon" aria-hidden="true">⏳</span>
            <span class="som-time-needed ${affordabilityClass}">Need: ${formatTimeDisplay(hoursNeeded)} more</span>
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
  return JSON.parse(data);
}

function saveGoalsData(data) {
  localStorage.setItem('som-utils-goals', JSON.stringify(data));
  console.log('SOM Utils: Saved goals data:', data);
}

function addGoalItem(itemData) {
  const goalsData = getGoalsData();
  
  const existingGoal = goalsData.goals.find(goal => goal.id === itemData.id);
  if (existingGoal) {
    return false;
  }
  
  const newGoal = {
    id: itemData.id,
    name: itemData.name,
    shellCost: itemData.shellCost,
    imageUrl: itemData.imageUrl || '',
    addedAt: Date.now(),
    priority: goalsData.goals.length + 1
  };
  
  goalsData.goals.push(newGoal);
  goalsData.totalShellsNeeded = goalsData.goals.reduce((sum, goal) => sum + goal.shellCost, 0);
  
  saveGoalsData(goalsData);
  return true;
}

function removeGoalItem(itemId) {
  const goalsData = getGoalsData();
  const initialLength = goalsData.goals.length;
  
  goalsData.goals = goalsData.goals.filter(goal => goal.id !== itemId);
  
  if (goalsData.goals.length < initialLength) {
    goalsData.goals.forEach((goal, index) => {
      goal.priority = index + 1;
    });
    goalsData.totalShellsNeeded = goalsData.goals.reduce((sum, goal) => sum + goal.shellCost, 0);
    
    saveGoalsData(goalsData);
    return true;
  }
  
  return false;
}

function isItemInGoals(itemId) {
  const goalsData = getGoalsData();
  return goalsData.goals.some(goal => goal.id === itemId);
}

function calculateGoalProgress() {
  const goalsData = getGoalsData();
  const currentShells = getCurrentUserShells();
  
  if (goalsData.goals.length === 0) {
    return {
      currentShells: currentShells,
      totalNeeded: 0,
      percentage: 100,
      shellsRemaining: 0,
      goals: []
    };
  }
  
  const totalNeeded = goalsData.totalShellsNeeded;
  const percentage = totalNeeded > 0 ? Math.min(100, (currentShells / totalNeeded) * 100) : 100;
  const shellsRemaining = Math.max(0, totalNeeded - currentShells);
  
  const goalsWithProgress = goalsData.goals
    .map(goal => {
      const progress = Math.min(100, (currentShells / goal.shellCost) * 100);
      const canAfford = currentShells >= goal.shellCost;
      return {
        ...goal,
        progress: progress,
        canAfford: canAfford
      };
    })
    .sort((a, b) => a.shellCost - b.shellCost); 
  
  return {
    currentShells: currentShells,
    totalNeeded: totalNeeded,
    percentage: percentage,
    shellsRemaining: shellsRemaining,
    goals: goalsWithProgress
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

function createGoalButton(itemData, isInGoals = false) {
  const button = document.createElement('button');
  button.className = `som-goal-button ${isInGoals ? 'som-goal-added' : 'som-goal-add'}`;
  button.setAttribute('data-item-id', itemData.id);
  button.setAttribute('aria-label', isInGoals ? `Remove ${itemData.name} from goals` : `Add ${itemData.name} to goals`);
  
  if (isInGoals) {
    button.innerHTML = `
      <span class="som-goal-icon">✅</span>
      <span class="som-goal-text">In Goals</span>
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
    toggleGoal(itemData, button);
  });
  
  return button;
}

function toggleGoal(itemData, buttonElement) {
  const isCurrentlyInGoals = isItemInGoals(itemData.id);
  
  if (isCurrentlyInGoals) {
    
    if (removeGoalItem(itemData.id)) {
      updateGoalButtonState(buttonElement, itemData, false);
      updateGoalsProgressHeader();
    }
  } else {
    
    if (addGoalItem(itemData)) {
      updateGoalButtonState(buttonElement, itemData, true);
      updateGoalsProgressHeader();
    }
  }
}

function updateGoalButtonState(buttonElement, itemData, isInGoals) {
  buttonElement.className = `som-goal-button ${isInGoals ? 'som-goal-added' : 'som-goal-add'}`;
  buttonElement.setAttribute('aria-label', isInGoals ? `Remove ${itemData.name} from goals` : `Add ${itemData.name} to goals`);
  
  if (isInGoals) {
    buttonElement.innerHTML = `
      <span class="som-goal-icon">✅</span>
      <span class="som-goal-text">In Goals</span>
    `;
  } else {
    buttonElement.innerHTML = `
      <span class="som-goal-icon">🎯</span>
      <span class="som-goal-text">Add Goal</span>
    `;
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
  
  if (card.querySelector('.som-goal-button')) {
    return;
  }
  
  const itemData = extractItemDataFromCard(card);
  if (!itemData.shellCost || itemData.shellCost <= 0) {
    return; 
  }
  
  const isInGoals = isItemInGoals(itemData.id);
  const goalButton = createGoalButton(itemData, isInGoals);
  
  const currentShells = getCurrentUserShells();
  const averageEfficiency = getUserAverageEfficiency();
  const accordion = createAdvancedStatsAccordion(itemData, currentShells, averageEfficiency);
  
  const enhancedEstimate = card.querySelector('.som-utils-enhanced-estimate');
  if (enhancedEstimate) {
    const progressContainer = enhancedEstimate.querySelector('.som-progress-container');
    
    if (progressContainer) {
      const lastTimeRow = progressContainer.querySelector('.som-time-estimates .som-time-row:last-child');
      if (lastTimeRow) {
        lastTimeRow.appendChild(goalButton);
      } else {
        enhancedEstimate.appendChild(goalButton);
      }
    } else {
      enhancedEstimate.appendChild(goalButton);
    }
    
    enhancedEstimate.parentNode.insertBefore(accordion, enhancedEstimate.nextSibling);
  } else {
    const cardBody = card.querySelector('div') || card;
    cardBody.appendChild(goalButton);
    cardBody.appendChild(accordion);
  }
}

function createGoalsProgressHeader() {
  const progressData = calculateGoalProgress();
  
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
      </div>
      <div class="som-goals-progress-container">
        <div class="som-goals-progress-bar" role="progressbar" aria-valuenow="${progressData.currentShells}" aria-valuemin="0" aria-valuemax="${progressData.totalNeeded}" aria-label="Goals progress: ${progressData.currentShells} out of ${progressData.totalNeeded} shells">
          ${createGoalMarkers(progressData.goals, progressData.totalNeeded, progressData.currentShells)}
        </div>
        <div class="som-goals-stats">
          <div class="som-goals-stat-item">
            <span class="som-goals-stat-value">${progressData.currentShells} / ${progressData.totalNeeded}</span>
            <span class="som-goals-stat-label">shells</span>
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
  
  return header;
}

function createGoalMarkers(goals, totalShells, currentShells) {
  
  const maxShellCost = goals.length > 0 ? Math.max(...goals.map(goal => goal.shellCost)) : 0;

  
  const progressPercentage = maxShellCost > 0 ? Math.min(100, (currentShells / maxShellCost) * 100) : 0;
  
  
  const markers = goals.map((goal) => {
    
    const position = maxShellCost > 0 ? (goal.shellCost / maxShellCost) * 100 : 0;
    
    return `
      <div class="som-goal-marker ${goal.canAfford ? 'som-goal-completed' : ''}"
           style="left: ${position}%"
           title="${goal.name} (${goal.shellCost} shells)"
           aria-label="Goal: ${goal.name}, ${goal.shellCost} shells, ${goal.canAfford ? 'completed' : 'in progress'}">
        <div class="som-goal-marker-circle">
          ${goal.imageUrl ? `<img src="${goal.imageUrl}" alt="${goal.name}" class="som-goal-marker-image" loading="lazy">` : `<span class="som-goal-marker-fallback">🎯</span>`}
        </div>
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
  
}

function updateGoalsProgressHeader() {
  addGoalsProgressHeader();
}

function processShopPage() {
  const shopCards = document.querySelectorAll('.card-with-gradient[data-controller="card"]');
  
  const averageEfficiency = getUserAverageEfficiency();
  

  addGoalsProgressHeader();
  
  shopCards.forEach(card => {
    updateShopTimeEstimate(card);
    addGoalButton(card);
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
      console.error('SOM Utils: Error pasting files:', error);
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


function processCurrentPage() {
  const currentPath = window.location.pathname;
  
  
  addFilePasteSupport();
  
  if (currentPath.startsWith('/projects/') && currentPath.match(/\/projects\/\d+/)) {
    processProjectPage();
  } else if (currentPath === '/shop') {
    processShopPage();
  } else {
    processProjectCards();
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
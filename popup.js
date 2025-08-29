document.addEventListener('DOMContentLoaded', () => {
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
  
  const themeOptions = document.querySelectorAll('.theme-option');
  const customBuilder = document.getElementById('custom-builder');
  const status = document.getElementById('status');

  let currentTheme = 'classic';
  
  let catppuccinColors = {
    'primary-50': '#f5e0dc',
    'primary-100': '#f2cdcd',
    'primary-200': '#f5c2e7',
    'primary-300': '#cba6f7',
    'primary-400': '#f38ba8',
    'primary-500': '#eba0ac',
    'primary-600': '#fab387',
    'primary-700': '#f9e2af',
    'primary-800': '#a6e3a1',
    'primary-900': '#94e2d5',
    'secondary-50': '#89dceb',
    'secondary-100': '#74c7ec',
    'secondary-200': '#89b4fa',
    'secondary-300': '#8aadf4',
    'secondary-400': '#b4befe',
    'secondary-500': '#cba6f7',
    'secondary-600': '#7f849c',
    'secondary-700': '#6c7086',
    'secondary-800': '#585b70',
    'secondary-900': '#45475a',
    'neutral-50': '#1e1e2e',
    'neutral-100': '#181825',
    'neutral-200': '#11111b',
    'neutral-300': '#313244',
    'neutral-400': '#45475a',
    'neutral-500': '#585b70',
    'neutral-600': '#6c7086',
    'neutral-700': '#7f849c',
    'neutral-800': '#9399b2',
    'neutral-900': '#cdd6f4'
  };

  api.storage.local.get(['somTheme', 'somCustomColors'], (result) => {
    if (result.somTheme) {
      currentTheme = result.somTheme;
    }
    if (result.somCustomColors) {
      catppuccinColors = {...catppuccinColors, ...result.somCustomColors};
    }
    updateUI();
    updatePopupTheme();
    if (currentTheme === 'custom') {
      customBuilder.classList.remove('hidden');
      loadCustomColors();
    }
  });

  themeOptions.forEach(button => {
    button.addEventListener('click', () => {
      setTheme(button.dataset.theme);
    });
  });


  function setTheme(theme) {
    currentTheme = theme;
    updateUI();
    updatePopupTheme();
    if (theme === 'custom') {
      customBuilder.classList.remove('hidden');
      loadCustomColors();
    } else {
      customBuilder.classList.add('hidden');
    }
    applyTheme();
  }

  function updateUI() {
    themeOptions.forEach(option => {
      option.classList.remove('active');
      if (option.dataset.theme === currentTheme) {
        option.classList.add('active');
      }
    });
  }

  function loadCustomColors() {
    if (!catppuccinColors || typeof catppuccinColors !== 'object') return;
    
    Object.keys(catppuccinColors).forEach(colorKey => {
      const input = document.getElementById(colorKey);
      if (input) {
        input.value = catppuccinColors[colorKey];
      }
    });
    attachColorInputListeners();
  }

  let websiteUpdateTimeout;

  function attachColorInputListeners() {
    if (!catppuccinColors || typeof catppuccinColors !== 'object') return;
    
    Object.keys(catppuccinColors).forEach(colorKey => {
      const input = document.getElementById(colorKey);
      if (input) {
        input.removeEventListener('input', input._colorInputHandler);
        input._colorInputHandler = () => {
          catppuccinColors[colorKey] = input.value;
          
          updatePopupTheme();
          updateThemePreview();
          
          clearTimeout(websiteUpdateTimeout);
          websiteUpdateTimeout = setTimeout(() => {
            applyWebsiteTheme();
          }, 300);
        };
        input.addEventListener('input', input._colorInputHandler);
      }
    });
  }

  async function applyWebsiteTheme() {
    try {
      api.storage.local.set({ somTheme: currentTheme, somCustomColors: catppuccinColors });

      const tabs = await api.tabs.query({ active: true, currentWindow: true });
      const tab = tabs && tabs.length > 0 ? tabs[0] : null;

      if (!tab || !tab.url?.includes('summer.hackclub.com')) {
        return;
      }

      await removeAllThemes(tab.id);

      if (currentTheme === 'catppuccin') {
        await executeScript({
          target: { tabId: tab.id },
          func: () => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = api.runtime.getURL('themes/catpuccin.css');
            link.setAttribute('data-som-utils-theme', 'catppuccin');
            document.head.appendChild(link);
          }
        });
      } else if (currentTheme === 'custom') {
        await applyCustomCSS(tab.id);
      }

      await executeScript({
        target: { tabId: tab.id },
        func: (theme, colors) => {
          localStorage.setItem('somTheme', theme);
          localStorage.setItem('somCustomColors', JSON.stringify(colors));
        },
        args: [currentTheme, catppuccinColors]
      });

    } catch (error) {
      console.error('Website theme application failed:', error);
    }
  }


  async function applyTheme(withStatus = true) {
    if (withStatus) showStatus('loading', '⏳ Applying theme...');
    
    try {
      api.storage.local.set({ somTheme: currentTheme, somCustomColors: catppuccinColors });

      const tabs = await api.tabs.query({ active: true, currentWindow: true });
      const tab = tabs && tabs.length > 0 ? tabs[0] : null;

      if (!tab || !tab.url?.includes('summer.hackclub.com')) {
        if (withStatus) {
          showStatus('error', '⚠️ Please navigate to summer.hackclub.com');
          setTimeout(hideStatus, 4000);
        }
        return;
      }

      await removeAllThemes(tab.id);

      if (currentTheme === 'catppuccin') {
        await executeScript({
          target: { tabId: tab.id },
          func: () => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = api.runtime.getURL('themes/catpuccin.css');
            link.setAttribute('data-som-utils-theme', 'catppuccin');
            document.head.appendChild(link);
          }
        });
      } else if (currentTheme === 'custom') {
        await applyCustomCSS(tab.id);
      }

      await executeScript({
        target: { tabId: tab.id },
        func: (theme, colors) => {
          localStorage.setItem('somTheme', theme);
          localStorage.setItem('somCustomColors', JSON.stringify(colors));
        },
        args: [currentTheme, catppuccinColors]
      });

      if (withStatus) {
        showStatus('success', `✅ Applied ${currentTheme} theme!`);
        setTimeout(() => {
          updatePopupTheme();
          updateThemePreview();
        }, 100);
        setTimeout(hideStatus, 2000);
      }

    } catch (error) {
      console.error('Theme application failed:', error);
      if (withStatus) {
        showStatus('error', `❌ ${error.message}`);
        setTimeout(hideStatus, 4000);
      }
    }
  }

  async function applyCustomCSS(tabId) {
    try {
      const response = await fetch(api.runtime.getURL('themes/custom.css'));
      let cssContent = await response.text();

      if (catppuccinColors && typeof catppuccinColors === 'object') {
        Object.keys(catppuccinColors).forEach(variable => {
          const color = catppuccinColors[variable];
          const regex = new RegExp(`--${variable}:\\s*#[a-f0-9]{6,8};`, 'gi');
          cssContent = cssContent.replace(regex, `--${variable}: ${color};`);
        });
      }

      const wrappedCSS = `/* SOM Utils Custom Theme - DO NOT REMOVE */\n${cssContent}`;
      
      await executeScript({
        target: { tabId: tabId },
        func: (css) => {
          const style = document.createElement('style');
          style.setAttribute('data-som-utils-theme', 'custom');
          style.textContent = css;
          document.head.appendChild(style);
        },
        args: [wrappedCSS]
      });
    } catch (error) {
      console.error('Failed to apply custom CSS:', error);
      throw error;
    }
  }

  async function removeAllThemes(tabId) {
    try {
      await executeScript({
        target: { tabId: tabId },
        func: () => {
          const catppuccinLinks = document.querySelectorAll('link[href*="catpuccin.css"]');
          catppuccinLinks.forEach(link => link.remove());
          
          const themeLinks = document.querySelectorAll('link[href*="themes/"]');
          themeLinks.forEach(link => link.remove());
          
          const markedLinks = document.querySelectorAll('link[data-som-utils-theme]');
          markedLinks.forEach(link => link.remove());

          const allStyles = document.querySelectorAll('style');
          allStyles.forEach(style => {
            const textContent = style.textContent || '';
            if (
              textContent.includes('SOM Utils') ||
              textContent.includes('SOM Utils Custom Theme') ||
              textContent.includes('SOM Utils Theme') ||
              style.hasAttribute('data-som-utils-theme')
            ) {
              style.remove();
            }
          });

          const markedStyles = document.querySelectorAll('style[data-som-utils-theme]');
          markedStyles.forEach(style => style.remove());

          localStorage.removeItem('somTheme');
          localStorage.removeItem('somCustomColors');
        }
      });
    } catch (e) {
      console.error('Failed to remove themes:', e);
    }
  }

  function showStatus(type, message) {
    if (!status) return;
    status.className = `status ${type}`;
    status.classList.remove('hidden');
    status.textContent = message;
  }

  function updatePopupTheme() {
    const root = document.documentElement;
    
    if (currentTheme === 'classic') {
      root.style.setProperty('--popup-bg', '#F6DBBA');
      root.style.setProperty('--popup-surface', 'rgba(246, 219, 186, 0.95)');
      root.style.setProperty('--popup-surface-alt', '#E6D4BE');
      root.style.setProperty('--popup-border', 'rgba(139, 115, 85, 0.6)');
      root.style.setProperty('--popup-border-hover', 'rgba(74, 45, 36, 0.8)');
      root.style.setProperty('--popup-text-primary', '#4A2D24');
      root.style.setProperty('--popup-text-secondary', '#5C4E3A');
      root.style.setProperty('--popup-text-muted', '#8B7355');
      root.style.setProperty('--popup-accent', '#4A2D24');
      root.style.setProperty('--popup-accent-light', 'rgba(246, 219, 186, 0.15)');
      root.style.setProperty('--popup-accent-hover', '#2D1B16');
    } else if (currentTheme === 'catppuccin') {
      root.style.setProperty('--popup-bg', '#1e1e2e');
      root.style.setProperty('--popup-surface', '#313244');
      root.style.setProperty('--popup-surface-alt', '#11111b');
      root.style.setProperty('--popup-border', '#7f849c');
      root.style.setProperty('--popup-border-hover', '#8aadf4');
      root.style.setProperty('--popup-text-primary', '#cdd6f4');
      root.style.setProperty('--popup-text-secondary', '#9399b2');
      root.style.setProperty('--popup-text-muted', '#6c7086');
      root.style.setProperty('--popup-accent', '#8aadf4');
      root.style.setProperty('--popup-accent-light', '#313244');
      root.style.setProperty('--popup-accent-hover', '#89b4fa');
    } else if (currentTheme === 'custom') {
      root.style.setProperty('--popup-bg', catppuccinColors['neutral-50']);
      root.style.setProperty('--popup-surface', catppuccinColors['neutral-300']);
      root.style.setProperty('--popup-surface-alt', catppuccinColors['neutral-200']);
      root.style.setProperty('--popup-border', catppuccinColors['secondary-600']);
      root.style.setProperty('--popup-border-hover', catppuccinColors['secondary-300']);
      root.style.setProperty('--popup-text-primary', catppuccinColors['neutral-900']);
      root.style.setProperty('--popup-text-secondary', catppuccinColors['neutral-800']);
      root.style.setProperty('--popup-text-muted', catppuccinColors['neutral-600']);
      root.style.setProperty('--popup-accent', catppuccinColors['secondary-300']);
      root.style.setProperty('--popup-accent-light', catppuccinColors['neutral-300']);
      root.style.setProperty('--popup-accent-hover', catppuccinColors['secondary-200']);
    }

    updateThemePreview();
  }

  function updateThemePreview() {
    const customPreview = document.querySelector('[data-theme="custom"] .theme-preview');
    if (customPreview) {
      const swatches = customPreview.querySelectorAll('.color-swatch');
      if (swatches.length >= 3) {
        swatches[0].style.background = catppuccinColors['neutral-50'];
        swatches[1].style.background = catppuccinColors['secondary-300'];
        swatches[2].style.background = catppuccinColors['neutral-900'];
      }
    }

    const catppuccinPreview = document.querySelector('[data-theme="catppuccin"] .theme-preview');
    if (catppuccinPreview) {
      const swatches = catppuccinPreview.querySelectorAll('.color-swatch');
      if (swatches.length >= 3) {
        swatches[0].style.background = '#1e1e2e';
        swatches[1].style.background = '#8aadf4';
        swatches[2].style.background = '#cdd6f4';
      }
    }
  }

  function hideStatus() {
    if (status) {
      status.classList.add('hidden');
    }
  }
});
class AIDetector {
  constructor() {
    this.isInitialized = true;
    this.apiEndpoint = 'https://ai.hackclub.com/chat/completions';
    this.model = 'qwen/qwen3-32b';
    this.system_prompt = `You are an expert AI text detector. Your task is to analyze the provided text and determine the probability that it was written by an AI.

Analyze the text for the following patterns:

HUMAN PATTERNS (lower AI probability 0.05-0.25):
- Natural imperfections: typos, informal grammar, inconsistent style
- Personal voice: use of "I think", "gonna", "pretty cool", casual contractions
- Direct and simple language: "Added this feature", "Fixed the bug"
- Authentic emotion: frustration or excitement: "finally got it working!", "this sucks"
- Technical but personal tone: "had issues with X, solved by doing Y"

HUMAN EXAMPLES:
"Added auto-update ability! Pretty cool feature"
"finally got the login working after debugging for hours"
"this was a pain to build but turned out okay i guess"
"gonna work on the mobile version next week"
"tbh the code is messy but it works lol"

AI PATTERNS (higher AI probability 0.70-0.95):
- Perfect grammar combined with a corporate tone
- Buzzword clusters: "comprehensive solution leveraging cutting-edge technology"
- Marketing speak: "showcasing expertise", "seamlessly integrates", "effortlessly optimizes"
- Structured lists with emoji bullets (e.g., ✅, 🎯, 🚀)
- Overuse of em dashes for emphasis—like this
- Generic and overly formal descriptions: "robust platform delivering exceptional results"
- Portfolio language: words like "showcasing", "demonstrating", "comprehensive", "innovative"

AI EXAMPLES:
"A comprehensive Discord bot showcasing advanced automation capabilities"
"Leveraging cutting-edge technology to deliver seamless user experiences"
"✅ Robust architecture ✅ Scalable design ✅ Enterprise-ready features"
"Effortlessly streamlining workflows through intelligent automation—powered by AI"
"This innovative solution demonstrates expertise in modern web development"

KEY INSIGHT: AI tends to use formal, marketing-oriented language with buzzwords and perfect structure, while humans write more casually and imperfectly with authentic personal voice.

The user will provide the text to analyze.

You must respond with only a valid JSON object with two keys:
1. "ai_probability": a float between 0.0 and 1.0 representing the likelihood the text is AI-generated
2. "confidence": a float between 0.0 and 1.0 representing your confidence in the prediction

Example response: {"ai_probability": 0.15, "confidence": 0.8}`;
    this.cache = new Map();
    this.pendingRequests = new Map()
    this.persistentCacheKey = 'somutils_ai_cache_v2'; 
    this.cacheExpiryHours = 2;
    this._loadPersistentCache();
  }
  
  async initialize() {
    return true;
  }
  
  async predict(text, maxRetries = 1) {
    const normalizedText = text.replace(/\s+/g, ' ').trim();
    const textHash = normalizedText.length + '_' + this._simpleHash(normalizedText);
    
    if (this.cache.has(textHash)) {
      const cachedResult = this.cache.get(textHash);
      const now = Date.now();
      const cacheAge = now - (cachedResult._cached_at || 0);
      const maxAge = this.cacheExpiryHours * 60 * 60 * 1000;
      
      if (cacheAge > maxAge || cachedResult._version !== 2) {
        this.cache.delete(textHash);
        this._savePersistentCache();
      } else {
        const {_cached_at, _version, ...cleanResult} = cachedResult;
        return cleanResult;
      }
    }

    if (this.pendingRequests.has(textHash)) {
      return await this.pendingRequests.get(textHash);
    }
    
    const apiPromise = this._makeApiRequest(text, maxRetries);
    this.pendingRequests.set(textHash, apiPromise);
    
    try {
      const result = await apiPromise;
      const cachedResult = {
        ...result,
        _cached_at: Date.now(),
        _version: 2
      };
      this.cache.set(textHash, cachedResult);
      this._savePersistentCache();
      this.pendingRequests.delete(textHash);
      return result;
    } catch (error) {
      this.pendingRequests.delete(textHash);
      throw error;
    }
  }
  
  async _makeApiRequest(text, maxRetries) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const requestBody = {
          messages: [
            {
              role: "system",
              content: this.system_prompt
            },
            {
              role: "user",
              content: text
            }
          ],
          model: this.model,
          temperature: 0.1,
          response_format: { type: "json_object" },
          max_completion_tokens: 40,
          include_reasoning: false
        };

        const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API error: ${response.status} - ${response.statusText}: ${errorText}`);
      }
      
      const data = await response.json();
      let analysisResult;
      try {
        const content = data.choices[0].message.content;
        analysisResult = JSON.parse(content);
      } catch (parseError) {
        throw new Error('Invalid JSON response from API');
      }
      
      const aiProbability = Math.max(0, Math.min(1, analysisResult.ai_probability || 0.5));
      const confidence = Math.max(0, Math.min(1, analysisResult.confidence || 0.5));
      
      const result = {
        chance_ai: aiProbability,
        confidence: confidence
      };
      
      return result;
      
      } catch (error) {
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  isReady() {
    return this.isInitialized;
  }
  
  isLoading() {
    return false;
  }
  
  getDiagnostics() {
    return {
      isInitialized: this.isInitialized,
      isLoading: false,
      apiEndpoint: this.apiEndpoint,
      model: this.model,
      systemStatus: 'ready'
    };
  }
  
  _simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < Math.min(str.length, 200); i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) & 0x7fffffff;
    }
    return hash.toString(36);
  }
  
  _loadPersistentCache() {
    try {
      const cached = localStorage.getItem(this.persistentCacheKey);
      if (cached) {
        const parsedCache = JSON.parse(cached);
        Object.entries(parsedCache).forEach(([key, value]) => {
          this.cache.set(key, value);
        });
      }
    } catch (error) {
      console.warn('Failed to load persistent cache:', error);
    }
  }
  
  _savePersistentCache() {
    try {
      const cacheObject = Object.fromEntries(this.cache);
      localStorage.setItem(this.persistentCacheKey, JSON.stringify(cacheObject));
    } catch (error) {
      console.warn('Failed to save persistent cache:', error);
    }
  }
  
  clearCache() {
    this.cache.clear();
    localStorage.removeItem(this.persistentCacheKey);
  }
  
  clearExpiredCache() {
    const now = Date.now();
    const maxAge = this.cacheExpiryHours * 60 * 60 * 1000;
    let removedCount = 0;
    
    for (const [key, value] of this.cache.entries()) {
      const cacheAge = now - (value._cached_at || 0);
      if (cacheAge > maxAge || value._version !== 2) {
        this.cache.delete(key);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      this._savePersistentCache();
    }
    return removedCount;
  }
  
  getCacheStats() {
    const totalEntries = this.cache.size;
    const now = Date.now();
    const maxAge = this.cacheExpiryHours * 60 * 60 * 1000;
    
    let expiredCount = 0;
    let validCount = 0;
    
    for (const [key, value] of this.cache.entries()) {
      const cacheAge = now - (value._cached_at || 0);
      if (cacheAge > maxAge || value._version !== 2) {
        expiredCount++;
      } else {
        validCount++;
      }
    }
    
    return {
      total: totalEntries,
      valid: validCount,
      expired: expiredCount,
      expiryHours: this.cacheExpiryHours
    };
  }
}

window.AIDetector = new AIDetector();
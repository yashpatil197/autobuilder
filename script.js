/* ══════════════════════════════════════════════
   AutoSite AI — Production-Grade No-Code Builder
   ══════════════════════════════════════════════ */

// ── App Controller ──
const App = {
  currentPage: 'page-landing',
  showPage(id, mode) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById(id);
    if (page) page.classList.add('active');
    this.currentPage = id;
    if (id === 'page-auth' && mode) Auth.setMode(mode);
    if (id === 'page-dashboard') Dashboard.init();
    if (id === 'page-editor') { if (window.lucide) lucide.createIcons(); }
  }
};

// ── Global State ──
const state = {
  isVerified: false,
  plan: 'trial',
  billingPeriod: 'monthly',
  currentSite: null,
  activePage: 'home',
  clipboard: null
};

// ── Toast ──
function showToast(message, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = message;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ── Modal ──
const Modal = {
  open(id) { const m = document.getElementById(id); if (m) m.classList.add('active'); },
  close(id) { const m = document.getElementById(id); if (m) m.classList.remove('active'); }
};

// ── Scroll helpers ──
function showSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}
function toggleMobileNav() {
  document.querySelector('.nav-links')?.classList.toggle('show');
}

// ── LocalStorage ──
const Store = {
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  remove(k) { localStorage.removeItem(k); },
  clear() { localStorage.clear(); }
};

// ══════════════════ HISTORY (UNDO/REDO) ══════════════════
const History = {
  undoStack: [],
  redoStack: [],
  maxSize: 50,
  push() {
    if (!state.currentSite) return;
    const snapshot = JSON.parse(JSON.stringify(state.currentSite));
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxSize) this.undoStack.shift();
    this.redoStack = [];
    this.updateUI();
  },
  undo() {
    if (this.undoStack.length === 0) return;
    const current = JSON.parse(JSON.stringify(state.currentSite));
    this.redoStack.push(current);
    state.currentSite = this.undoStack.pop();
    Editor.loadSiteNoHistory(state.currentSite);
    showToast('Undo', 'info');
    this.updateUI();
  },
  redo() {
    if (this.redoStack.length === 0) return;
    const current = JSON.parse(JSON.stringify(state.currentSite));
    this.undoStack.push(current);
    state.currentSite = this.redoStack.pop();
    Editor.loadSiteNoHistory(state.currentSite);
    showToast('Redo', 'info');
    this.updateUI();
  },
  updateUI() {
    const ub = document.getElementById('btn-undo');
    const rb = document.getElementById('btn-redo');
    if (ub) ub.classList.toggle('disabled-btn', this.undoStack.length === 0);
    if (rb) rb.classList.toggle('disabled-btn', this.redoStack.length === 0);
  },
  clear() { this.undoStack = []; this.redoStack = []; this.updateUI(); }
};

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); History.undo(); }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); History.redo(); }
});

// ══════════════════ AUTH ══════════════════
const Auth = {
  mode: 'signup',
  setMode(m) {
    this.mode = m;
    const title = document.getElementById('auth-title');
    const sub = document.getElementById('auth-subtitle');
    const btn = document.getElementById('auth-submit');
    const toggle = document.getElementById('auth-toggle');
    const fields = document.getElementById('signup-fields');
    if (m === 'signup') {
      if (title) title.textContent = 'Create your account';
      if (sub) sub.textContent = 'Start your 30-day free trial';
      if (btn) btn.textContent = 'Create Account';
      if (toggle) toggle.innerHTML = 'Already have an account? <a href="#" onclick="Auth.toggleMode()">Log in</a>';
      if (fields) fields.style.display = '';
    } else {
      if (title) title.textContent = 'Welcome back';
      if (sub) sub.textContent = 'Log in to your account';
      if (btn) btn.textContent = 'Log In';
      if (toggle) toggle.innerHTML = 'Don\'t have an account? <a href="#" onclick="Auth.toggleMode()">Sign up</a>';
      if (fields) fields.style.display = 'none';
    }
  },
  toggleMode() { this.setMode(this.mode === 'signup' ? 'login' : 'signup'); },
  submit() {
    const email = document.getElementById('auth-email').value.trim();
    const pass = document.getElementById('auth-password').value.trim();
    if (!email || !pass) return showToast('Please fill all fields', 'error');
    if (this.mode === 'signup') {
      const name = document.getElementById('auth-name').value.trim();
      if (!name) return showToast('Please enter your name', 'error');
      Store.set('currentUser', { name, email, plan: 'trial', sites: [] });
      showToast('Account created!', 'success');
      Verification.open(email);
    } else {
      const user = Store.get('currentUser');
      if (!user || user.email !== email) return showToast('Invalid credentials', 'error');
      if (!Store.get('isVerified')) { Verification.open(email); return; }
      state.isVerified = true;
      state.plan = user.plan || 'trial';
      App.showPage('page-dashboard');
    }
  },
  socialLogin(provider) {
    const name = provider === 'google' ? 'Google User' : 'GitHub User';
    const email = `user@${provider}.com`;
    let user = Store.get('currentUser');
    if (!user) { user = { name, email, plan: 'trial', sites: [] }; Store.set('currentUser', user); }
    if (Store.get('isVerified')) {
      state.isVerified = true;
      state.plan = user.plan || 'trial';
      showToast(`Signed in with ${provider} 🎉`, 'success');
      App.showPage('page-dashboard');
    } else { Verification.open(email); }
  },
  logout() { App.showPage('page-landing'); showToast('Logged out', 'info'); },
  deleteAccount() {
    if (!confirm('Delete your account? This cannot be undone.')) return;
    Store.clear(); state.isVerified = false; state.plan = 'trial';
    App.showPage('page-landing'); showToast('Account deleted', 'info');
  },
  checkTrial() {
    const d = Store.get('signupDate');
    if (!d) return { active: true, days: 30 };
    const days = Math.floor((new Date() - new Date(d)) / 86400000);
    return { active: days < 30 || state.plan !== 'trial', days: Math.max(0, 30 - days) };
  }
};

// ══════════════════ ONBOARDING ══════════════════
const Onboard = {
  step: 1,
  data: { bizType: '', designStyle: '', prompt: '' },
  reset() {
    this.step = 1; this.data = { bizType: '', designStyle: '', prompt: '' };
    document.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
    const p = document.getElementById('ai-prompt'); if (p) p.value = '';
    this.showStep(); this.updateProgress();
  },
  select(el, key) {
    el.parentElement.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected'); this.data[key] = el.dataset.value;
  },
  updateProgress() {
    const bar = document.getElementById('onboard-bar');
    if (bar) bar.style.width = (this.step * 33) + '%';
  },
  next() {
    if (this.step === 1 && !this.data.bizType) return showToast('Please select a type', 'error');
    if (this.step === 2 && !this.data.designStyle) return showToast('Please select a style', 'error');
    this.step++; this.showStep(); this.updateProgress();
  },
  prev() { if (this.step > 1) { this.step--; this.showStep(); this.updateProgress(); } },
  showStep() {
    document.querySelectorAll('.onboard-step').forEach(s => s.classList.remove('active'));
    const s = document.getElementById('onboard-' + this.step);
    if (s) s.classList.add('active');
  },
  useSuggestion(el) { document.getElementById('ai-prompt').value = el.textContent.trim(); },
  generate() {
    if (!state.isVerified) { showToast('Please verify your email first', 'error'); Verification.open(); return; }
    this.data.prompt = document.getElementById('ai-prompt').value.trim();
    if (!this.data.prompt) return showToast('Please describe your website', 'error');
    document.querySelectorAll('.onboard-step').forEach(s => s.classList.remove('active'));
    document.getElementById('onboard-loading').classList.add('active');
    this.runLoadingAnimation();
  },
  runLoadingAnimation() {
    const steps = ['ls-1', 'ls-2', 'ls-3', 'ls-4', 'ls-5'];
    let i = 0;
    const interval = setInterval(() => {
      i++;
      if (i >= steps.length) {
        clearInterval(interval);
        setTimeout(() => {
          const user = Store.get('currentUser');
          // ── Paywall: 2 free sites, 3rd requires subscription ──
          const maxFree = 2;
          const hasSub = SiteTimer.hasActiveSubscription(user);
          const planSlots = { trial: maxFree, starter: 3, pro: 10, agency: 999 };
          const maxSites = hasSub ? (planSlots[user.plan] || maxFree) : maxFree;
          if (user && user.sites.length >= maxSites) {
            App.showPage('page-dashboard');
            Dashboard.showUpgrade();
            showToast(`You've reached the ${hasSub ? user.plan : 'free'} limit of ${maxSites} sites. Upgrade to create more!`, 'error');
            return;
          }
          // ── Generate 5 variations and show Choice Canvas ──
          const variations = AIEngine.generateVariations(this.data);
          ChoiceCanvas.show(variations, this.data);
          App.showPage('page-choice-canvas');
        }, 600);
        return;
      }
      const prev = document.getElementById(steps[i - 1]);
      if (prev) { prev.classList.add('done'); prev.textContent = '✓ ' + prev.textContent.substring(2); }
      const cur = document.getElementById(steps[i]);
      if (cur) cur.classList.add('active');
    }, 800);
  }
};

// ══════════════════ PRESET THEMES ══════════════════
const PresetThemes = {
  presets: {
    modern: { primary: '#6C5CE7', secondary: '#a29bfe', bg: '#0a0a1a', text: '#ffffff', accent: '#00D2FF', headingFont: 'Inter', bodyFont: 'Inter' },
    bold: { primary: '#FF6B6B', secondary: '#ee5a5a', bg: '#1a0a0a', text: '#ffffff', accent: '#FFE66D', headingFont: 'Inter', bodyFont: 'Inter' },
    minimal: { primary: '#333333', secondary: '#555555', bg: '#ffffff', text: '#111111', accent: '#666666', headingFont: 'Inter', bodyFont: 'Inter' },
    dark: { primary: '#BB86FC', secondary: '#9965f4', bg: '#121212', text: '#e0e0e0', accent: '#03DAC6', headingFont: 'Inter', bodyFont: 'Inter' },
    playful: { primary: '#FF6B9D', secondary: '#ff85b1', bg: '#FFF5F7', text: '#2D2D2D', accent: '#C44DFF', headingFont: 'Poppins', bodyFont: 'Inter' },
    elegant: { primary: '#C9A96E', secondary: '#b8944f', bg: '#0D0D0D', text: '#F5F0EB', accent: '#8B7355', headingFont: 'Playfair Display', bodyFont: 'Inter' }
  },
  apply(presetKey) {
    if (!state.currentSite) return;
    const p = this.presets[presetKey];
    if (!p) return;
    History.push();
    state.currentSite.globalStyles = {
      ...state.currentSite.globalStyles,
      colors: { primary: p.primary, secondary: p.secondary, bg: p.bg, text: p.text, accent: p.accent },
      typography: { ...state.currentSite.globalStyles.typography, headingFont: p.headingFont, bodyFont: p.bodyFont },
      preset: presetKey
    };
    // Update all sections
    Object.values(state.currentSite.sections).forEach(s => {
      s.styles = { ...s.styles, primary: p.primary, bg: p.bg, text: p.text, accent: p.accent };
    });
    Editor.saveSite();
    Editor.renderSite();
    showToast(`Applied "${presetKey}" theme`, 'success');
  },
  getList() { return Object.keys(this.presets); }
};

// ══════════════════ AI ENGINE ══════════════════
const AIEngine = {
  generate(data) {
    const { bizType, designStyle, prompt } = data;
    const theme = PresetThemes.presets[designStyle] || PresetThemes.presets.modern;
    const templates = { business: this.businessTpl, portfolio: this.portfolioTpl, ecommerce: this.ecommerceTpl, blog: this.blogTpl, restaurant: this.restaurantTpl, saas: this.saasTpl };
    const tplFn = templates[bizType] || this.businessTpl;
    const ctx = this.contextContent(prompt, bizType);
    const sectionsArr = tplFn.call(this, prompt, theme, ctx);
    const sectionsMap = {};
    sectionsArr.forEach(s => { sectionsMap[s.id] = s; });
    const sectionIds = sectionsArr.map(s => s.id);

    return {
      id: 'site_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: ctx.brandName,
      slug: ctx.brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      version: 1,
      status: 'draft',
      seo: { title: ctx.brandName, description: prompt.substring(0, 160), ogImage: '' },
      globalStyles: {
        colors: { primary: theme.primary, secondary: theme.secondary || theme.primary, bg: theme.bg, text: theme.text, accent: theme.accent },
        typography: { headingFont: theme.headingFont || 'Inter', bodyFont: theme.bodyFont || 'Inter', baseFontSize: 16 },
        spacing: { sectionPadding: 80, containerMax: 1200 },
        animations: { enabled: true, type: 'fadeIn', duration: 0.6 },
        preset: designStyle
      },
      pages: [{ id: 'home', name: 'Home', slug: '/', isHome: true, sections: sectionIds, seo: { title: '', description: '' } }],
      sections: sectionsMap,
      components: [],
      forms: {},
      analytics: { views: Math.floor(Math.random() * 500 + 100), visitors: 0, interactions: [] },
      collaboration: { shareId: Math.random().toString(36).substr(2, 8), comments: [] },
      published: false, publishedUrl: null, publishedVersions: [],
      createdAt: new Date().toISOString()
    };
  },
  // ── Generate 5 structurally unique template layouts ──
  generateVariations(data) {
    const { bizType, prompt } = data;
    const ctx = this.contextContent(prompt, bizType);
    const presets = ['minimal', 'dark', 'playful', 'elegant', 'bold'];
    const templates = [
      {
        label: 'Classic',
        desc: 'Hero → Features → About → Testimonials → CTA → Footer',
        build: (t, id) => [
          this._s(id + 's1', 'hero', { heading: ctx.hero, subheading: ctx.sub, cta: 'Get Started', cta2: 'Learn More' }, t),
          this._s(id + 's2', 'features', { heading: 'Why Choose Us', items: ctx.features }, t),
          this._s(id + 's3', 'about', { heading: `About ${ctx.brandName}`, text: ctx.about, image: '🏢' }, t),
          this._s(id + 's4', 'testimonials', { heading: 'What Clients Say', items: ctx.testimonials }, t),
          this._s(id + 's5', 'cta', { heading: ctx.cta, subheading: ctx.ctaSub, cta: 'Start Now' }, t),
          this._s(id + 's6', 'footer', { brand: ctx.brandName, links: ['About', 'Services', 'Contact', 'Privacy'] }, t)
        ]
      },
      {
        label: 'Showcase',
        desc: 'Hero → Gallery → About → Contact → Footer',
        build: (t, id) => [
          this._s(id + 's1', 'hero', { heading: ctx.hero, subheading: ctx.sub, cta: 'View Work', cta2: 'Get in Touch' }, t),
          this._s(id + 's2', 'gallery', { heading: 'Our Work', items: ctx.features.map(f => f.icon + ' ' + f.title) }, t),
          this._s(id + 's3', 'about', { heading: `Our Story`, text: ctx.about, image: '🎯' }, t),
          this._s(id + 's4', 'testimonials', { heading: 'Client Feedback', items: ctx.testimonials }, t),
          this._s(id + 's5', 'contact', { heading: 'Get in Touch', subheading: ctx.ctaSub }, t),
          this._s(id + 's6', 'footer', { brand: ctx.brandName, links: ['Portfolio', 'About', 'Contact', 'Blog'] }, t)
        ]
      },
      {
        label: 'Conversion',
        desc: 'Hero → Features → Pricing → CTA → Footer',
        build: (t, id) => [
          this._s(id + 's1', 'hero', { heading: ctx.hero, subheading: ctx.sub, cta: 'Start Free Trial', cta2: 'See Plans' }, t),
          this._s(id + 's2', 'features', { heading: 'Powerful Features', items: ctx.features }, t),
          this._s(id + 's3', 'pricing', {
            heading: 'Simple Pricing', plans: [
              { name: 'Basic', price: '₹499/mo', features: ['Core Features', '1 User', 'Email Support'] },
              { name: 'Pro', price: '₹1,499/mo', features: ['All Features', '10 Users', 'Priority Support', 'API Access'], popular: true },
              { name: 'Enterprise', price: '₹3,999/mo', features: ['Unlimited', 'Custom Setup', '24/7 Support', 'SLA'] }
            ]
          }, t),
          this._s(id + 's4', 'cta', { heading: ctx.cta, subheading: ctx.ctaSub, cta: 'Get Started Free' }, t),
          this._s(id + 's5', 'footer', { brand: ctx.brandName, links: ['Features', 'Pricing', 'FAQ', 'Support'] }, t)
        ]
      },
      {
        label: 'Storyteller',
        desc: 'Hero → About → Testimonials → Features → Contact → Footer',
        build: (t, id) => [
          this._s(id + 's1', 'hero', { heading: ctx.hero, subheading: ctx.sub, cta: 'Our Story', cta2: 'Contact Us' }, t),
          this._s(id + 's2', 'about', { heading: `The ${ctx.brandName} Story`, text: ctx.about, image: '📖' }, t),
          this._s(id + 's3', 'testimonials', { heading: 'Voices of Trust', items: ctx.testimonials }, t),
          this._s(id + 's4', 'features', { heading: 'What We Offer', items: ctx.features }, t),
          this._s(id + 's5', 'contact', { heading: 'Let\'s Talk', subheading: ctx.ctaSub }, t),
          this._s(id + 's6', 'footer', { brand: ctx.brandName, links: ['Story', 'Services', 'Testimonials', 'Contact'] }, t)
        ]
      },
      {
        label: 'Starter',
        desc: 'Hero → Features → CTA → Footer (minimal, fast)',
        build: (t, id) => [
          this._s(id + 's1', 'hero', { heading: ctx.hero, subheading: ctx.sub, cta: 'Get Started', cta2: '' }, t),
          this._s(id + 's2', 'features', { heading: 'Why ' + ctx.brandName + '?', items: ctx.features }, t),
          this._s(id + 's3', 'cta', { heading: ctx.cta, subheading: ctx.ctaSub, cta: 'Start Now' }, t),
          this._s(id + 's4', 'footer', { brand: ctx.brandName, links: ['About', 'Contact', 'Privacy'] }, t)
        ]
      }
    ];
    return templates.map((tpl, i) => {
      const theme = PresetThemes.presets[presets[i]] || PresetThemes.presets.modern;
      const uid = 'v' + i + '_';
      const sectionsArr = tpl.build(theme, uid);
      const sectionsMap = {};
      sectionsArr.forEach(s => { sectionsMap[s.id] = s; });
      const sectionIds = sectionsArr.map(s => s.id);
      return {
        label: tpl.label,
        desc: tpl.desc,
        site: {
          id: 'site_' + Date.now() + '_' + i,
          name: ctx.brandName,
          slug: ctx.brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          version: 1,
          status: 'draft',
          seo: { title: ctx.brandName, description: prompt.substring(0, 160), ogImage: '' },
          globalStyles: {
            colors: { primary: theme.primary, secondary: theme.secondary || theme.primary, bg: theme.bg, text: theme.text, accent: theme.accent },
            typography: { headingFont: theme.headingFont || 'Inter', bodyFont: theme.bodyFont || 'Inter', baseFontSize: 16 },
            spacing: { sectionPadding: 80, containerMax: 1200 },
            animations: { enabled: true, type: 'fadeIn', duration: 0.6 },
            preset: presets[i]
          },
          pages: [{ id: 'home', name: 'Home', slug: '/', isHome: true, sections: sectionIds, seo: { title: '', description: '' } }],
          sections: sectionsMap,
          components: [],
          forms: {},
          analytics: { views: Math.floor(Math.random() * 500 + 100), visitors: 0, interactions: [] },
          collaboration: { shareId: Math.random().toString(36).substr(2, 8), comments: [] },
          published: false, publishedUrl: null, publishedVersions: [],
          createdAt: new Date().toISOString()
        }
      };
    });
  },
  // ── Context-Aware Content from User Prompt ──
  contextContent(prompt, bizType) {
    const words = prompt.split(/\s+/);
    const brandName = words.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const lp = prompt.toLowerCase();
    // Industry detection
    const industries = {
      tech: /tech|software|app|digital|code|saas|startup|ai|platform/,
      health: /health|fitness|wellness|medical|yoga|gym|clinic/,
      food: /food|restaurant|cafe|bakery|cook|chef|catering|pizza/,
      fashion: /fashion|clothing|style|boutique|apparel|wear|design/,
      finance: /finance|bank|invest|money|trading|crypto|accounting/,
      education: /school|edu|learn|course|tutor|academy|training/,
      creative: /art|photo|design|studio|creative|video|music/,
      realestate: /real estate|property|home|house|apartment|realt/
    };
    let industry = 'general';
    for (const [k, re] of Object.entries(industries)) { if (re.test(lp)) { industry = k; break; } }
    // Industry-specific content
    const content = {
      tech: {
        hero: `Transform Your Digital Future with ${brandName}`,
        sub: `Cutting-edge ${words.length > 3 ? words.slice(3, 8).join(' ') : 'technology solutions'} designed to accelerate your growth and streamline operations.`,
        features: [{ icon: '⚡', title: 'Lightning Performance', desc: 'Blazing-fast infrastructure built for scale.' }, { icon: '🛡️', title: 'Enterprise Security', desc: 'Bank-grade encryption and compliance.' }, { icon: '📊', title: 'Real-Time Analytics', desc: 'Data-driven insights at your fingertips.' }, { icon: '🔗', title: 'Seamless Integrations', desc: 'Connect with 200+ tools effortlessly.' }],
        about: `${brandName} is pioneering the next generation of ${lp.includes('ai') ? 'artificial intelligence' : 'digital'} solutions. Our team of experts is committed to delivering technology that makes a real difference.`,
        testimonials: [{ name: 'Arjun S.', role: 'CTO, TechVenture', text: `${brandName} transformed our entire workflow. Productivity up 40%.`, avatar: '👨‍💻' }, { name: 'Priya M.', role: 'VP Engineering', text: 'The best technology investment we made this year.', avatar: '👩‍💼' }],
        cta: `Start Building with ${brandName}`, ctaSub: 'Join thousands of developers and businesses already scaling.',
      },
      health: {
        hero: `Your Journey to Wellness Starts with ${brandName}`,
        sub: `Holistic ${words.length > 3 ? words.slice(3, 8).join(' ') : 'health and wellness'} programs tailored to your unique needs.`,
        features: [{ icon: '🧘', title: 'Personalized Programs', desc: 'Custom plans for your goals.' }, { icon: '🍎', title: 'Nutrition Guidance', desc: 'Expert dietary recommendations.' }, { icon: '💪', title: 'Expert Trainers', desc: 'Certified professionals by your side.' }, { icon: '📈', title: 'Progress Tracking', desc: 'Monitor your transformation journey.' }],
        about: `At ${brandName}, we believe wellness is a lifestyle. Our certified experts combine science-backed methods with compassionate care.`,
        testimonials: [{ name: 'Sneha R.', role: 'Member', text: `${brandName} changed my life. Down 15kg and feeling amazing!`, avatar: '🧑‍⚕️' }, { name: 'Rahul K.', role: 'Athlete', text: 'Best training program I have ever experienced.', avatar: '🏃' }],
        cta: `Begin Your Transformation`, ctaSub: 'First consultation is completely free.',
      },
      food: {
        hero: `Savor Every Moment at ${brandName}`,
        sub: `Exquisite ${words.length > 3 ? words.slice(3, 8).join(' ') : 'culinary experiences'} crafted with passion and the finest ingredients.`,
        features: [{ icon: '🥗', title: 'Fresh Ingredients', desc: 'Locally sourced, farm-to-table.' }, { icon: '🍽️', title: 'Curated Menu', desc: 'Chef\'s seasonal specialties.' }, { icon: '🍷', title: 'Fine Selection', desc: 'Premium wines and beverages.' }, { icon: '🎂', title: 'Artisan Desserts', desc: 'Handcrafted sweet perfection.' }],
        about: `${brandName} brings together culinary tradition and modern innovation. Every dish tells a story of passion, quality, and artistry.`,
        testimonials: [{ name: 'Anita D.', role: 'Food Critic', text: `${brandName} is a culinary masterpiece. A must-visit experience.`, avatar: '👩‍🍳' }, { name: 'Vikram P.', role: 'Regular Guest', text: 'The flavors are absolutely extraordinary.', avatar: '🧑‍🍳' }],
        cta: `Reserve Your Table at ${brandName}`, ctaSub: 'Experience dining at its finest.',
      },
      fashion: {
        hero: `Redefine Your Style with ${brandName}`,
        sub: `Discover ${words.length > 3 ? words.slice(3, 8).join(' ') : 'curated fashion collections'} that express your unique personality.`,
        features: [{ icon: '👗', title: 'New Collections', desc: 'Fresh styles every season.' }, { icon: '✨', title: 'Premium Quality', desc: 'Luxury fabrics and craftsmanship.' }, { icon: '🚚', title: 'Free Shipping', desc: 'Complimentary delivery worldwide.' }, { icon: '🔄', title: 'Easy Returns', desc: '30-day hassle-free returns.' }],
        about: `${brandName} is where timeless elegance meets contemporary fashion. We curate pieces that make you feel confident and extraordinary.`,
        testimonials: [{ name: 'Meera S.', role: 'Style Blogger', text: `${brandName}'s quality is unmatched. My go-to for every occasion.`, avatar: '👩‍🎤' }, { name: 'Karan J.', role: 'Customer', text: 'Beautifully crafted pieces that stand the test of time.', avatar: '🧑' }],
        cta: `Shop the ${brandName} Collection`, ctaSub: 'Free shipping on your first order.',
      },
      finance: {
        hero: `Secure Your Financial Future with ${brandName}`,
        sub: `Smart ${words.length > 3 ? words.slice(3, 8).join(' ') : 'financial solutions'} to grow and protect your wealth.`,
        features: [{ icon: '💰', title: 'Smart Investing', desc: 'AI-driven portfolio management.' }, { icon: '🛡️', title: 'Secure Transactions', desc: 'Military-grade encryption.' }, { icon: '📈', title: 'Growth Analytics', desc: 'Real-time market insights.' }, { icon: '🤝', title: 'Expert Advisors', desc: 'Certified financial planners.' }],
        about: `${brandName} empowers individuals and businesses with intelligent financial tools. Our platform combines expertise with cutting-edge technology.`,
        testimonials: [{ name: 'Deepak T.', role: 'Investor', text: `${brandName} helped me grow my portfolio by 35% in one year.`, avatar: '👨‍💼' }, { name: 'Nisha K.', role: 'Business Owner', text: 'Finally, financial management that makes sense.', avatar: '👩‍💼' }],
        cta: `Start Investing with ${brandName}`, ctaSub: 'Open your account in under 5 minutes.',
      },
      education: {
        hero: `Unlock Your Potential with ${brandName}`,
        sub: `World-class ${words.length > 3 ? words.slice(3, 8).join(' ') : 'learning experiences'} designed by industry experts.`,
        features: [{ icon: '🎓', title: 'Expert Instructors', desc: 'Learn from the very best.' }, { icon: '📚', title: 'Rich Curriculum', desc: 'Comprehensive course material.' }, { icon: '🏆', title: 'Certifications', desc: 'Industry-recognized credentials.' }, { icon: '🌐', title: 'Learn Anywhere', desc: '100% online, your pace.' }],
        about: `${brandName} is dedicated to making quality education accessible. Our programs bridge the gap between knowledge and real-world application.`,
        testimonials: [{ name: 'Aditi C.', role: 'Student', text: `${brandName}'s courses helped me land my dream job!`, avatar: '👩‍🎓' }, { name: 'Rohan M.', role: 'Professional', text: 'The best upskilling platform I have used.', avatar: '👨‍🎓' }],
        cta: `Start Learning at ${brandName}`, ctaSub: 'First course is completely free.',
      },
      creative: {
        hero: `Creative Excellence by ${brandName}`,
        sub: `Stunning ${words.length > 3 ? words.slice(3, 8).join(' ') : 'creative work'} that captivates audiences and defines brands.`,
        features: [{ icon: '🎨', title: 'Brand Identity', desc: 'Logos, colors, typography.' }, { icon: '📱', title: 'Digital Design', desc: 'Web, mobile, and app interfaces.' }, { icon: '🎬', title: 'Motion Graphics', desc: 'Animated stories that inspire.' }, { icon: '📸', title: 'Photography', desc: 'Professional visual storytelling.' }],
        about: `${brandName} is a creative studio that transforms ideas into powerful visual experiences. We partner with brands to create work that matters.`,
        testimonials: [{ name: 'Tara N.', role: 'Creative Director', text: `${brandName}'s work consistently exceeds expectations.`, avatar: '🎨' }, { name: 'Jay B.', role: 'Brand Manager', text: 'They brought our vision to life beautifully.', avatar: '👨‍🎤' }],
        cta: `Start Your Project with ${brandName}`, ctaSub: 'Let\'s create something extraordinary together.',
      },
      realestate: {
        hero: `Find Your Dream Home with ${brandName}`,
        sub: `Premium ${words.length > 3 ? words.slice(3, 8).join(' ') : 'properties'} in prime locations, curated for discerning buyers.`,
        features: [{ icon: '🏠', title: 'Premium Listings', desc: 'Hand-picked luxury properties.' }, { icon: '📍', title: 'Prime Locations', desc: 'Best neighborhoods and areas.' }, { icon: '💳', title: 'Easy Financing', desc: 'Flexible payment options.' }, { icon: '🛠️', title: 'Full Support', desc: 'End-to-end buying assistance.' }],
        about: `${brandName} connects you with exceptional properties. Our experienced agents ensure a seamless journey from search to keys-in-hand.`,
        testimonials: [{ name: 'Suresh P.', role: 'Homeowner', text: `${brandName} made buying our first home effortless!`, avatar: '🏡' }, { name: 'Pooja G.', role: 'Investor', text: 'Excellent properties and professional service.', avatar: '👩‍💼' }],
        cta: `Explore Properties with ${brandName}`, ctaSub: 'Schedule your free property tour today.',
      },
      general: {
        hero: `Welcome to ${brandName}`,
        sub: `${prompt.length > 30 ? prompt.substring(0, 80) : 'Innovative solutions crafted to elevate your business and delight your customers.'}`,
        features: [{ icon: '🚀', title: 'Fast & Reliable', desc: 'Built for performance and speed.' }, { icon: '🔒', title: 'Secure & Trusted', desc: 'Your data is always safe.' }, { icon: '💬', title: 'Expert Support', desc: '24/7 assistance when you need it.' }, { icon: '⭐', title: 'Top Quality', desc: 'Excellence in every detail.' }],
        about: `${brandName} is dedicated to delivering exceptional quality and service. We combine innovation with deep expertise to create solutions that truly matter.`,
        testimonials: [{ name: 'Amit S.', role: 'Client', text: `Working with ${brandName} was an outstanding experience!`, avatar: '👨‍💼' }, { name: 'Riya T.', role: 'Partner', text: 'Professional, reliable, and highly recommended.', avatar: '👩‍💼' }],
        cta: `Get Started with ${brandName}`, ctaSub: 'Join hundreds of satisfied customers today.',
      }
    };
    const c = content[industry] || content.general;
    return { brandName, industry, ...c };
  },
  extractName(prompt, type) {
    const w = prompt.split(' ').slice(0, 3).join(' ');
    return w.charAt(0).toUpperCase() + w.slice(1) + ' Site';
  },
  voices: {
    professional: { adj: 'professional', tone: 'authoritative and data-driven' },
    friendly: { adj: 'friendly', tone: 'warm and conversational' },
    luxury: { adj: 'luxurious', tone: 'refined and exclusive' },
    startup: { adj: 'bold startup', tone: 'disruptive and energetic' }
  },
  rewriteInVoice(text, voice) {
    const v = this.voices[voice] || this.voices.professional;
    const rewrites = {
      professional: [
        text.replace(/amazing|incredible|awesome/gi, 'exceptional').replace(/!/g, '.'),
        'Our ' + v.adj + ' approach delivers measurable results. ' + text.split('.')[0] + '.',
        text.replace(/we/gi, 'Our team').replace(/you/gi, 'clients')
      ],
      friendly: [
        'Hey there! ' + text.replace(/\./g, '! ').trim(),
        'We\'re so excited to share this with you — ' + text.toLowerCase(),
        text.replace(/$/, ' 😊').replace(/\./g, '! ')
      ],
      luxury: [
        text.replace(/good|great|nice/gi, 'exquisite').replace(/make|create/gi, 'curate'),
        'Experience the pinnacle of ' + text.split(' ').slice(0, 5).join(' ').toLowerCase() + '.',
        'Exclusively crafted. ' + text.replace(/!/g, '.')
      ],
      startup: [
        '🚀 ' + text.replace(/help/gi, 'supercharge').replace(/improve/gi, '10x'),
        'We\'re disrupting the status quo. ' + text,
        text.replace(/\./g, ' 💪.').replace(/we are/gi, 'we\'re')
      ]
    };
    return rewrites[voice] || [text, text + ' (rewritten)', 'Alternative: ' + text];
  },
  // Section templates
  _s(id, type, content, theme) { return { id, type, content, styles: { primary: theme.primary, bg: theme.bg, text: theme.text, accent: theme.accent }, responsive: { tablet: {}, mobile: {} }, animation: { type: 'fadeIn', enabled: true } }; },
  businessTpl(p, t, ctx) {
    return [
      this._s('s1', 'hero', { heading: ctx.hero, subheading: ctx.sub, cta: 'Get Started', cta2: 'Learn More' }, t),
      this._s('s2', 'features', { heading: 'Why Choose Us', items: ctx.features }, t),
      this._s('s3', 'about', { heading: `About ${ctx.brandName}`, text: ctx.about, image: '🏢' }, t),
      this._s('s4', 'testimonials', { heading: 'What Our Clients Say', items: ctx.testimonials }, t),
      this._s('s5', 'cta', { heading: ctx.cta, subheading: ctx.ctaSub, cta: 'Start Free Trial' }, t),
      this._s('s6', 'footer', { brand: ctx.brandName, links: ['About', 'Services', 'Contact', 'Privacy'] }, t)
    ];
  },
  portfolioTpl(p, t, ctx) {
    return [
      this._s('s1', 'hero', { heading: ctx.hero, subheading: ctx.sub, cta: 'View Work', cta2: 'Contact Me' }, t),
      this._s('s2', 'gallery', { heading: 'Featured Work', items: ctx.features.map(f => f.icon + ' ' + f.title) }, t),
      this._s('s3', 'about', { heading: `About ${ctx.brandName}`, text: ctx.about, image: '🎨' }, t),
      this._s('s4', 'contact', { heading: 'Let\'s Connect', subheading: ctx.ctaSub }, t),
      this._s('s5', 'footer', { brand: ctx.brandName, links: ['Work', 'About', 'Contact', 'Instagram'] }, t)
    ];
  },
  ecommerceTpl(p, t, ctx) {
    return [
      this._s('s1', 'hero', { heading: ctx.hero, subheading: ctx.sub, cta: 'Shop Now', cta2: 'New Arrivals' }, t),
      this._s('s2', 'features', { heading: 'Featured Products', items: ctx.features }, t),
      this._s('s3', 'testimonials', { heading: 'Customer Reviews', items: ctx.testimonials }, t),
      this._s('s4', 'cta', { heading: ctx.cta, subheading: ctx.ctaSub, cta: 'Subscribe' }, t),
      this._s('s5', 'footer', { brand: ctx.brandName, links: ['Products', 'About', 'FAQ', 'Returns'] }, t)
    ];
  },
  blogTpl(p, t, ctx) {
    return [
      this._s('s1', 'hero', { heading: ctx.hero, subheading: ctx.sub, cta: 'Read Latest', cta2: 'Subscribe' }, t),
      this._s('s2', 'features', { heading: 'Recent Posts', items: ctx.features }, t),
      this._s('s3', 'cta', { heading: ctx.cta, subheading: ctx.ctaSub, cta: 'Subscribe Now' }, t),
      this._s('s4', 'footer', { brand: ctx.brandName, links: ['Articles', 'About', 'Newsletter', 'RSS'] }, t)
    ];
  },
  restaurantTpl(p, t, ctx) {
    return [
      this._s('s1', 'hero', { heading: ctx.hero, subheading: ctx.sub, cta: 'Reserve a Table', cta2: 'View Menu' }, t),
      this._s('s2', 'features', { heading: 'Our Menu', items: ctx.features }, t),
      this._s('s3', 'about', { heading: `Our Story`, text: ctx.about, image: '🍽️' }, t),
      this._s('s4', 'contact', { heading: 'Make a Reservation', subheading: ctx.ctaSub }, t),
      this._s('s5', 'footer', { brand: ctx.brandName, links: ['Menu', 'Reservations', 'Events', 'Contact'] }, t)
    ];
  },
  saasTpl(p, t, ctx) {
    return [
      this._s('s1', 'hero', { heading: ctx.hero, subheading: ctx.sub, cta: 'Start Free Trial', cta2: 'View Demo' }, t),
      this._s('s2', 'features', { heading: 'Powerful Features', items: ctx.features }, t),
      this._s('s3', 'pricing', { heading: 'Simple Pricing', plans: [{ name: 'Starter', price: '₹999/mo', features: ['5 Users', '10GB', 'Email Support'] }, { name: 'Pro', price: '₹2,499/mo', features: ['25 Users', '100GB', 'Priority Support', 'API'], popular: true }, { name: 'Enterprise', price: '₹4,999/mo', features: ['Unlimited', '1TB', '24/7 Support', 'Custom'] }] }, t),
      this._s('s4', 'testimonials', { heading: 'Trusted by Teams', items: ctx.testimonials }, t),
      this._s('s5', 'cta', { heading: ctx.cta, subheading: ctx.ctaSub, cta: 'Get Started Free' }, t),
      this._s('s6', 'footer', { brand: ctx.brandName, links: ['Features', 'Pricing', 'Docs', 'Support'] }, t)
    ];
  }
};

// ══════════════════ CHOICE CANVAS ══════════════════
const ChoiceCanvas = {
  variations: [],
  onboardData: null,
  show(variations, data) {
    this.variations = variations;
    this.onboardData = data;
    const grid = document.getElementById('choice-grid');
    if (!grid) return;
    grid.innerHTML = variations.map((v, i) => {
      const site = v.site;
      const heroSection = Object.values(site.sections)[0];
      const preview = heroSection ? Renderer.renderSection(heroSection, false) : '';
      return `<div class="choice-card" onclick="ChoiceCanvas.select(${i})">
        <div class="choice-preview">${preview}</div>
        <div class="choice-info">
          <h3>${v.label}</h3>
          <p>${v.desc}</p>
        </div>
        <button class="btn btn-outline btn-sm btn-block">Select This Style</button>
      </div>`;
    }).join('');
  },
  select(index) {
    const v = this.variations[index];
    if (!v) return;
    const site = v.site;
    const user = Store.get('currentUser');
    if (user) { user.sites.push(site); Store.set('currentUser', user); }
    state.currentSite = site;
    Editor.loadSite(site);
    App.showPage('page-editor');
    showToast(`${v.label} style selected! 🎉`, 'success');
  }
};

// ══════════════════ DEEP EDIT ══════════════════
const DeepEdit = {
  init() {
    const canvas = document.getElementById('editor-canvas');
    if (!canvas) return;
    // Text selection AI toolbar
    canvas.addEventListener('mouseup', (e) => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) { this.hideToolbar(); return; }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      this.showToolbar(rect, sel.toString());
    });
    // Image click handler for suggestions
    canvas.addEventListener('click', (e) => {
      const target = e.target;
      if (target.style?.fontSize && parseInt(target.style.fontSize) >= 32 && /[\u{1F300}-\u{1FAFF}]/u.test(target.textContent)) {
        this.showImageSuggestions(target);
      }
    });
  },
  showToolbar(rect, text) {
    let tb = document.getElementById('ai-float-toolbar');
    if (!tb) {
      tb = document.createElement('div');
      tb.id = 'ai-float-toolbar';
      tb.className = 'ai-float-toolbar';
      document.body.appendChild(tb);
    }
    this._selectedText = text;
    tb.innerHTML = `
      <span class="ai-tb-label">✨ AI Rewrite</span>
      <button onclick="DeepEdit.rewrite('shorter')">Shorter</button>
      <button onclick="DeepEdit.rewrite('longer')">Longer</button>
      <button onclick="DeepEdit.rewrite('professional')">Professional</button>
      <button onclick="DeepEdit.rewrite('friendly')">Friendly</button>
      <button onclick="DeepEdit.rewrite('luxury')">Luxury</button>`;
    tb.style.display = 'flex';
    tb.style.top = (rect.top + window.scrollY - 44) + 'px';
    tb.style.left = Math.max(10, rect.left + rect.width / 2 - 200) + 'px';
  },
  hideToolbar() {
    const tb = document.getElementById('ai-float-toolbar');
    if (tb) tb.style.display = 'none';
  },
  rewrite(mode) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const text = this._selectedText || sel.toString();
    let result = text;
    if (mode === 'shorter') {
      result = text.split('.').slice(0, 1).join('.') + '.';
    } else if (mode === 'longer') {
      result = text + ' We are committed to delivering excellence in every aspect of our work, ensuring complete satisfaction.';
    } else {
      const variants = AIEngine.rewriteInVoice(text, mode);
      result = variants[Math.floor(Math.random() * variants.length)];
    }
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(result));
    this.hideToolbar();
    Editor.saveSite();
    showToast(`Rewritten (${mode})`, 'success');
  },
  showImageSuggestions(el) {
    let popup = document.getElementById('ai-image-popup');
    if (!popup) {
      popup = document.createElement('div');
      popup.id = 'ai-image-popup';
      popup.className = 'ai-image-popup';
      document.body.appendChild(popup);
    }
    this._imageTarget = el;
    const industry = state.currentSite?.seo?.description?.toLowerCase() || '';
    const emojiSets = {
      tech: ['💻', '🖥️', '📱', '⚙️', '🤖', '🔬'],
      health: ['🧘', '🏋️', '🍏', '❤️', '🌿', '🏃'],
      food: ['🍽️', '🍳', '🧁', '🍰', '🍍', '🥗'],
      fashion: ['👗', '👜', '👠', '🧥', '👟', '🧵'],
      default: ['🏢', '🌟', '💡', '🎯', '🚀', '🏆']
    };
    let setKey = 'default';
    for (const [k, re] of Object.entries({ tech: /tech|software|code|ai/, health: /health|fitness|gym/, food: /food|restaurant|cook/, fashion: /fashion|cloth|style/ })) {
      if (re.test(industry)) { setKey = k; break; }
    }
    const emojis = emojiSets[setKey];
    popup.innerHTML = `<div class="ai-img-label">🎨 Suggest Alternatives</div>
      <div class="ai-img-grid">${emojis.map(e => `<button onclick="DeepEdit.replaceImage('${e}')">${e}</button>`).join('')}</div>`;
    const rect = el.getBoundingClientRect();
    popup.style.display = 'block';
    popup.style.top = (rect.bottom + window.scrollY + 8) + 'px';
    popup.style.left = (rect.left + rect.width / 2 - 120) + 'px';
  },
  replaceImage(emoji) {
    if (this._imageTarget) {
      this._imageTarget.textContent = emoji;
      Editor.saveSite();
      showToast('Image updated', 'success');
    }
    const popup = document.getElementById('ai-image-popup');
    if (popup) popup.style.display = 'none';
  }
};
// ══════════════════ RENDERER ══════════════════
const Renderer = {
  renderSection(section, editable = false) {
    const { type, content, styles } = section;
    const ct = editable ? 'contenteditable="true"' : '';
    const bg = styles.bg || '#0a0a1a';
    const primary = styles.primary || '#6C5CE7';
    const tc = styles.text || '#ffffff';
    const tm = this.muted(tc);
    const anim = section.animation?.enabled ? `data-anim="${section.animation.type || 'fadeIn'}"` : '';

    switch (type) {
      case 'hero':
        return `<div class="rs rs-hero" ${anim} style="background:${bg};color:${tc};padding:80px 40px;text-align:center;background-image:radial-gradient(ellipse at 50% 0%,${primary}22 0%,transparent 60%)">
          <h1 ${ct} style="font-size:clamp(28px,5vw,56px);font-weight:900;margin-bottom:16px;line-height:1.1">${content.heading}</h1>
          <p ${ct} style="font-size:18px;color:${tm};max-width:560px;margin:0 auto 32px">${content.subheading}</p>
          <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
            <button style="padding:14px 32px;background:linear-gradient(135deg,${primary},${styles.accent || primary});color:#fff;border:none;border-radius:10px;font-weight:700;font-size:15px;cursor:pointer">${content.cta}</button>
            ${content.cta2 ? `<button style="padding:14px 32px;background:transparent;color:${tc};border:1px solid ${tc}33;border-radius:10px;font-weight:600;cursor:pointer">${content.cta2}</button>` : ''}</div></div>`;
      case 'features':
        return `<div class="rs rs-feat" ${anim} style="background:${bg};color:${tc};padding:80px 40px">
          <h2 ${ct} style="text-align:center;font-size:32px;font-weight:800;margin-bottom:48px">${content.heading}</h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:24px;max-width:960px;margin:0 auto">
            ${content.items.map(i => `<div style="padding:28px;background:${tc}08;border:1px solid ${tc}12;border-radius:16px"><div style="font-size:32px;margin-bottom:12px">${i.icon}</div><h3 ${ct} style="font-size:16px;margin-bottom:8px">${i.title}</h3><p ${ct} style="font-size:14px;color:${tm}">${i.desc}</p></div>`).join('')}</div></div>`;
      case 'about':
        return `<div class="rs rs-about" ${anim} style="background:${bg};color:${tc};padding:80px 40px"><div style="max-width:800px;margin:0 auto;display:flex;gap:40px;align-items:center;flex-wrap:wrap">
          <div style="flex:1;min-width:200px;font-size:80px;text-align:center">${content.image}</div>
          <div style="flex:2;min-width:280px"><h2 ${ct} style="font-size:32px;font-weight:800;margin-bottom:16px">${content.heading}</h2><p ${ct} style="color:${tm};line-height:1.8">${content.text}</p></div></div></div>`;
      case 'gallery':
        return `<div class="rs rs-gallery" ${anim} style="background:${bg};color:${tc};padding:80px 40px">
          <h2 ${ct} style="text-align:center;font-size:32px;font-weight:800;margin-bottom:48px">${content.heading}</h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;max-width:900px;margin:0 auto">
            ${content.items.map(i => `<div style="aspect-ratio:1;background:linear-gradient(135deg,${primary}22,${primary}44);border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;padding:20px;text-align:center">${i}</div>`).join('')}</div></div>`;
      case 'testimonials':
        return `<div class="rs rs-test" ${anim} style="background:${bg};color:${tc};padding:80px 40px">
          <h2 ${ct} style="text-align:center;font-size:32px;font-weight:800;margin-bottom:48px">${content.heading}</h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px;max-width:960px;margin:0 auto">
            ${content.items.map(t => `<div style="padding:28px;background:${tc}08;border:1px solid ${tc}12;border-radius:16px"><p ${ct} style="color:${tm};margin-bottom:20px;font-style:italic">"${t.text}"</p><div style="display:flex;align-items:center;gap:12px"><span style="font-size:32px">${t.avatar}</span><div><strong ${ct}>${t.name}</strong><br><small style="color:${tm}">${t.role}</small></div></div></div>`).join('')}</div></div>`;
      case 'pricing':
        return `<div class="rs rs-price" ${anim} style="background:${bg};color:${tc};padding:80px 40px">
          <h2 ${ct} style="text-align:center;font-size:32px;font-weight:800;margin-bottom:48px">${content.heading}</h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:24px;max-width:900px;margin:0 auto">
            ${content.plans.map(p => `<div style="padding:32px;background:${tc}08;border:${p.popular ? '2px' : '1px'} solid ${p.popular ? primary : tc + '12'};border-radius:16px;${p.popular ? 'box-shadow:0 0 30px ' + primary + '44' : ''}"><h3 style="font-size:18px;margin-bottom:8px">${p.name}</h3><div style="font-size:36px;font-weight:900;margin-bottom:20px">${p.price}</div>${p.features.map(f => `<div style="padding:8px 0;color:${tm};font-size:14px;border-bottom:1px solid ${tc}08">✓ ${f}</div>`).join('')}<button style="width:100%;margin-top:20px;padding:12px;background:${p.popular ? `linear-gradient(135deg,${primary},${styles.accent || primary})` : 'transparent'};color:${p.popular ? '#fff' : tc};border:${p.popular ? 'none' : '1px solid ' + tc + '33'};border-radius:10px;font-weight:700;cursor:pointer">Choose Plan</button></div>`).join('')}</div></div>`;
      case 'contact':
        return `<div class="rs rs-contact" ${anim} style="background:${bg};color:${tc};padding:80px 40px"><div style="max-width:560px;margin:0 auto;text-align:center">
          <h2 ${ct} style="font-size:32px;font-weight:800;margin-bottom:8px">${content.heading}</h2>
          <p ${ct} style="color:${tm};margin-bottom:32px">${content.subheading}</p>
          <input style="width:100%;padding:14px 16px;background:${tc}08;border:1px solid ${tc}15;border-radius:10px;color:${tc};margin-bottom:12px;font-size:14px" placeholder="Your Name"/>
          <input style="width:100%;padding:14px 16px;background:${tc}08;border:1px solid ${tc}15;border-radius:10px;color:${tc};margin-bottom:12px;font-size:14px" placeholder="Your Email"/>
          <textarea style="width:100%;padding:14px 16px;background:${tc}08;border:1px solid ${tc}15;border-radius:10px;color:${tc};margin-bottom:16px;min-height:120px;font-size:14px;resize:vertical" placeholder="Your Message"></textarea>
          <button style="width:100%;padding:14px;background:linear-gradient(135deg,${primary},${styles.accent || primary});color:#fff;border:none;border-radius:10px;font-weight:700;font-size:15px;cursor:pointer">Send Message</button></div></div>`;
      case 'form':
        const fields = content.fields || [{ type: 'text', label: 'Name', placeholder: 'Your name' }, { type: 'email', label: 'Email', placeholder: 'Your email' }, { type: 'textarea', label: 'Message', placeholder: 'Your message' }];
        return `<div class="rs rs-form" ${anim} style="background:${bg};color:${tc};padding:80px 40px"><div style="max-width:560px;margin:0 auto">
          <h2 ${ct} style="font-size:32px;font-weight:800;margin-bottom:8px;text-align:center">${content.heading || 'Contact Form'}</h2>
          <p ${ct} style="color:${tm};margin-bottom:32px;text-align:center">${content.subheading || 'Fill out the form below'}</p>
          ${fields.map(f => {
          if (f.type === 'textarea') return `<label style="display:block;font-size:13px;color:${tm};margin-bottom:4px">${f.label}</label><textarea style="width:100%;padding:14px;background:${tc}08;border:1px solid ${tc}15;border-radius:10px;color:${tc};margin-bottom:12px;min-height:100px;resize:vertical" placeholder="${f.placeholder || ''}"></textarea>`;
          if (f.type === 'select') return `<label style="display:block;font-size:13px;color:${tm};margin-bottom:4px">${f.label}</label><select style="width:100%;padding:14px;background:${tc}08;border:1px solid ${tc}15;border-radius:10px;color:${tc};margin-bottom:12px">${(f.options || ['Option 1', 'Option 2']).map(o => `<option>${o}</option>`).join('')}</select>`;
          if (f.type === 'checkbox') return `<label style="display:flex;align-items:center;gap:8px;margin-bottom:12px;color:${tm};font-size:14px"><input type="checkbox" style="width:18px;height:18px"/>${f.label}</label>`;
          return `<label style="display:block;font-size:13px;color:${tm};margin-bottom:4px">${f.label}</label><input type="${f.type}" style="width:100%;padding:14px;background:${tc}08;border:1px solid ${tc}15;border-radius:10px;color:${tc};margin-bottom:12px" placeholder="${f.placeholder || ''}"/>`;
        }).join('')}
          <button onclick="FormBuilder.handleSubmit('${section.id}')" style="width:100%;padding:14px;background:linear-gradient(135deg,${primary},${styles.accent || primary});color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer">${content.submitText || 'Submit'}</button></div></div>`;
      case 'cta':
        return `<div class="rs rs-cta" ${anim} style="background:linear-gradient(135deg,${primary},${styles.accent || primary});color:#fff;padding:80px 40px;text-align:center">
          <h2 ${ct} style="font-size:32px;font-weight:800;margin-bottom:12px">${content.heading}</h2>
          <p ${ct} style="opacity:0.85;max-width:480px;margin:0 auto 28px">${content.subheading}</p>
          <button style="padding:16px 40px;background:#fff;color:${primary};border:none;border-radius:10px;font-weight:800;font-size:16px;cursor:pointer">${content.cta}</button></div>`;
      case 'footer':
        const dbg = bg === '#ffffff' ? '#f0f0f0' : '#050510';
        return `<div class="rs rs-footer" ${anim} style="background:${dbg};color:${tm};padding:40px;text-align:center">
          <div style="font-size:18px;font-weight:800;color:${tc};margin-bottom:16px">⚡ ${content.brand}</div>
          <div style="display:flex;gap:24px;justify-content:center;flex-wrap:wrap;margin-bottom:16px">${content.links.map(l => `<a style="color:${tm};text-decoration:none;font-size:14px">${l}</a>`).join('')}</div>
          <p style="font-size:12px">© 2026 ${content.brand}. All rights reserved.</p></div>`;
      default: return `<div style="padding:40px;text-align:center;color:#888">Unknown: ${type}</div>`;
    }
  },
  muted(c) { return c === '#ffffff' || c === '#fff' ? '#a0a0c0' : '#888'; },
  renderFullSite(site) { return Object.values(site.sections).map(s => this.renderSection(s, false)).join(''); }
};

// ══════════════════ EDITOR ══════════════════
const Editor = {
  currentSite: null, selectedSection: null, activePage: 'home', dragType: null,
  sectionTemplates: {
    hero: { heading: 'New Hero Section', subheading: 'Add your description.', cta: 'Get Started', cta2: 'Learn More' },
    features: { heading: 'Features', items: [{ icon: '⭐', title: 'Feature 1', desc: 'Description.' }, { icon: '💎', title: 'Feature 2', desc: 'Description.' }, { icon: '🎯', title: 'Feature 3', desc: 'Description.' }, { icon: '🔥', title: 'Feature 4', desc: 'Description.' }] },
    about: { heading: 'About Us', text: 'Share your story.', image: '🏢' },
    gallery: { heading: 'Gallery', items: ['Project 1', 'Project 2', 'Project 3', 'Project 4', 'Project 5', 'Project 6'] },
    testimonials: { heading: 'Testimonials', items: [{ name: 'Jane Doe', role: 'Customer', text: 'Amazing!', avatar: '👩' }, { name: 'John Smith', role: 'Client', text: 'Recommended!', avatar: '👨' }] },
    pricing: { heading: 'Pricing', plans: [{ name: 'Basic', price: '$9/mo', features: ['Feature 1', 'Feature 2'] }, { name: 'Pro', price: '$29/mo', features: ['Feature 1', 'Feature 2', 'Feature 3'], popular: true }, { name: 'Enterprise', price: '$99/mo', features: ['Everything', 'Priority Support'] }] },
    contact: { heading: 'Contact Us', subheading: 'Get in touch.' },
    form: { heading: 'Contact Form', subheading: 'Fill out below', fields: [{ type: 'text', label: 'Name', placeholder: 'Your name' }, { type: 'email', label: 'Email', placeholder: 'Your email' }, { type: 'textarea', label: 'Message', placeholder: 'Your message' }], submitText: 'Submit' },
    cta: { heading: 'Take Action Now', subheading: 'Start your journey.', cta: 'Get Started' },
    footer: { brand: 'My Site', links: ['Home', 'About', 'Contact', 'Privacy'] }
  },

  loadSite(site) {
    this.currentSite = site;
    state.currentSite = site;
    this.activePage = site.pages[0]?.id || 'home';
    state.activePage = this.activePage;
    document.getElementById('editor-site-name').textContent = site.name;
    this.syncThemeInputs();
    this.renderSite();
    this.renderPagesList();
    this.renderComponentsList();
    // ── Freeze guard: block editor if site is frozen ──
    const frozen = SiteTimer.isFrozen(site);
    const overlay = document.getElementById('editor-trial-overlay');
    if (overlay) overlay.style.display = frozen ? 'flex' : 'none';
    PlanManager.applyPlanFeatures();
    VersionManager.updateUI();
    History.clear();
    if (window.lucide) lucide.createIcons();
    this.updateStatusBadge();
  },
  loadSiteNoHistory(site) {
    this.currentSite = site;
    state.currentSite = site;
    document.getElementById('editor-site-name').textContent = site.name;
    this.syncThemeInputs();
    this.renderSite();
    this.renderPagesList();
    this.renderComponentsList();
    this.updateStatusBadge();
    if (window.lucide) lucide.createIcons();
  },
  syncThemeInputs() {
    if (!this.currentSite) return;
    const g = this.currentSite.globalStyles;
    const el = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
    el('theme-primary', g.colors.primary);
    el('theme-bg', g.colors.bg);
    el('theme-text', g.colors.text);
    el('theme-font', g.typography.headingFont);
    el('theme-preset', g.preset || 'modern');
    el('theme-animation', g.animations.type || 'fadeIn');
    el('theme-spacing', g.spacing.sectionPadding || 80);
  },

  // ── UNIFIED RENDER PIPELINE ──
  renderSite() {
    if (!this.currentSite) return;
    const canvas = document.getElementById('editor-canvas');
    const page = this.currentSite.pages.find(p => p.id === this.activePage);
    if (!page) return;
    const trial = Auth.checkTrial();
    const sectionIds = page.sections || [];
    canvas.innerHTML = sectionIds.map((sid, idx) => {
      const section = this.currentSite.sections[sid];
      if (!section) return '';
      return `<div class="editor-section" data-idx="${idx}" data-sid="${sid}" onclick="Editor.selectSection(${idx},'${sid}')">
        <div class="section-overlay">
          <button onclick="event.stopPropagation();Editor.moveSection(${idx},-1)" title="Move Up"><span class="material-icons-round" style="font-size:16px">arrow_upward</span></button>
          <button onclick="event.stopPropagation();Editor.moveSection(${idx},1)" title="Move Down"><span class="material-icons-round" style="font-size:16px">arrow_downward</span></button>
          <button onclick="event.stopPropagation();Editor.duplicateSection(${idx})" title="Duplicate"><span class="material-icons-round" style="font-size:16px">content_copy</span></button>
          <button onclick="event.stopPropagation();Editor.saveAsComponent('${sid}')" title="Save Component"><span class="material-icons-round" style="font-size:16px">bookmark_add</span></button>
          <button onclick="event.stopPropagation();Editor.deleteSection(${idx})" title="Delete"><span class="material-icons-round" style="font-size:16px">delete</span></button>
        </div>
        ${Renderer.renderSection(section, trial.active)}
      </div>`;
    }).join('');
    this.applyCanvasVars();
    ContentRewriter.attachButtons();
    if (window.lucide) lucide.createIcons();
  },
  applyCanvasVars() {
    if (!this.currentSite) return;
    const c = document.getElementById('editor-canvas');
    const g = this.currentSite.globalStyles;
    if (!c) return;
    c.style.setProperty('--site-primary', g.colors.primary);
    c.style.setProperty('--site-bg', g.colors.bg);
    c.style.setProperty('--site-text', g.colors.text);
    c.style.setProperty('--site-accent', g.colors.accent);
    c.style.setProperty('--site-font', g.typography.headingFont);
  },

  // ── PAGES ──
  renderPagesList() {
    if (!this.currentSite) return;
    const list = document.getElementById('editor-pages-list');
    list.innerHTML = this.currentSite.pages.map(p =>
      `<div class="page-item ${p.id === this.activePage ? 'active' : ''}" onclick="Editor.switchPage('${p.id}')">
        ${p.name}${p.isHome ? ' <small>🏠</small>' : ''}
        <span class="page-actions">
          <span class="material-icons-round" style="font-size:14px" onclick="event.stopPropagation();Editor.duplicatePage('${p.id}')" title="Duplicate">content_copy</span>
          ${!p.isHome ? `<span class="material-icons-round" style="font-size:14px" onclick="event.stopPropagation();Editor.deletePage('${p.id}')" title="Delete">close</span>` : ''}
        </span>
      </div>`
    ).join('');
  },
  switchPage(id) { this.activePage = id; state.activePage = id; this.renderPagesList(); this.renderSite(); },
  addPage() {
    if (!this.currentSite) return;
    const maxPages = PlanManager.getLimit('pages');
    if (this.currentSite.pages.length >= maxPages) { showToast(`Upgrade for more pages (max ${maxPages})`, 'error'); return; }
    const name = prompt('Page name:');
    if (!name) return;
    History.push();
    const id = 'page_' + Date.now();
    this.currentSite.pages.push({ id, name, slug: '/' + name.toLowerCase().replace(/\s+/g, '-'), isHome: false, sections: [], seo: { title: '', description: '' } });
    this.saveSite(); this.renderPagesList();
    showToast('Page added!', 'success');
  },
  duplicatePage(pageId) {
    History.push();
    const page = this.currentSite.pages.find(p => p.id === pageId);
    if (!page) return;
    const newPage = JSON.parse(JSON.stringify(page));
    newPage.id = 'page_' + Date.now();
    newPage.name = page.name + ' (Copy)';
    newPage.isHome = false;
    // Deep-clone sections too
    const newSections = {};
    newPage.sections = newPage.sections.map(sid => {
      const ns = JSON.parse(JSON.stringify(this.currentSite.sections[sid]));
      const newId = 's_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
      ns.id = newId;
      this.currentSite.sections[newId] = ns;
      return newId;
    });
    this.currentSite.pages.push(newPage);
    this.saveSite(); this.renderPagesList();
    showToast('Page duplicated!', 'success');
  },
  deletePage(pageId) {
    if (!confirm('Delete this page?')) return;
    History.push();
    const page = this.currentSite.pages.find(p => p.id === pageId);
    if (page) page.sections.forEach(sid => delete this.currentSite.sections[sid]);
    this.currentSite.pages = this.currentSite.pages.filter(p => p.id !== pageId);
    if (this.activePage === pageId) this.switchPage(this.currentSite.pages[0]?.id || 'home');
    this.saveSite(); this.renderPagesList();
    showToast('Page deleted', 'info');
  },

  // ── SECTIONS ──
  selectSection(idx, sid) {
    this.selectedSection = { idx, sid };
    document.querySelectorAll('.editor-section').forEach((el, i) => el.classList.toggle('selected', i === idx));
  },
  moveSection(idx, dir) {
    History.push();
    const page = this.currentSite.pages.find(p => p.id === this.activePage);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= page.sections.length) return;
    [page.sections[idx], page.sections[newIdx]] = [page.sections[newIdx], page.sections[idx]];
    this.saveSite(); this.renderSite(); this.scrollToSection(newIdx);
  },
  duplicateSection(idx) {
    History.push();
    const page = this.currentSite.pages.find(p => p.id === this.activePage);
    const sid = page.sections[idx];
    const section = JSON.parse(JSON.stringify(this.currentSite.sections[sid]));
    const newId = 's_' + Date.now();
    section.id = newId;
    this.currentSite.sections[newId] = section;
    page.sections.splice(idx + 1, 0, newId);
    this.saveSite(); this.renderSite(); this.scrollToSection(idx + 1);
    showToast('Section duplicated', 'success');
  },
  deleteSection(idx) {
    if (!confirm('Delete this section?')) return;
    History.push();
    const page = this.currentSite.pages.find(p => p.id === this.activePage);
    const sid = page.sections[idx];
    delete this.currentSite.sections[sid];
    page.sections.splice(idx, 1);
    this.rebalanceLayout();
    this.saveSite(); this.renderSite();
    showToast('Section deleted — layout rebalanced', 'info');
  },
  rebalanceLayout() {
    if (!this.currentSite) return;
    const page = this.currentSite.pages.find(p => p.id === this.activePage);
    if (!page) return;
    const sectionCount = page.sections.length;
    // Increase section padding when fewer sections to maintain visual balance
    const basePadding = sectionCount <= 2 ? 120 : sectionCount <= 4 ? 100 : 80;
    this.currentSite.globalStyles.spacing.sectionPadding = basePadding;
    // Ensure first visible section has extra top padding if not hero
    if (page.sections.length > 0) {
      const firstSec = this.currentSite.sections[page.sections[0]];
      if (firstSec && firstSec.type !== 'hero') {
        firstSec.styles._extraTopPad = true;
      }
    }
  },
  addSection(type) {
    if (!this.currentSite) return showToast('No site loaded', 'error');
    const trial = Auth.checkTrial();
    if (!trial.active) { Modal.open('modal-trial-expired'); return; }
    History.push();
    const g = this.currentSite.globalStyles;
    const content = JSON.parse(JSON.stringify(this.sectionTemplates[type] || { heading: 'New Section' }));
    const newId = 's_' + Date.now();
    const section = { id: newId, type, content, styles: { primary: g.colors.primary, bg: g.colors.bg, text: g.colors.text, accent: g.colors.accent }, responsive: { tablet: {}, mobile: {} }, animation: { type: g.animations.type, enabled: g.animations.enabled } };
    this.currentSite.sections[newId] = section;
    const page = this.currentSite.pages.find(p => p.id === this.activePage);
    if (page) page.sections.push(newId);
    this.saveSite(); this.renderSite();
    this.scrollToSection(page.sections.length - 1);
    showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} section added!`, 'success');
  },
  scrollToSection(idx) {
    setTimeout(() => {
      const el = document.querySelector(`[data-idx="${idx}"]`);
      if (el) {
        const wrap = document.querySelector('.editor-canvas-wrap');
        wrap.scrollTo({ top: el.offsetTop - 20, behavior: 'smooth' });
        el.classList.add('selected');
        setTimeout(() => el.classList.remove('selected'), 1500);
      }
    }, 50);
  },

  // ── REUSABLE COMPONENTS ──
  saveAsComponent(sid) {
    if (!PlanManager.hasFeature('components')) { showToast('Upgrade to Agency for reusable components', 'error'); return; }
    const section = this.currentSite.sections[sid];
    if (!section) return;
    const name = prompt('Component name:', section.type + ' component');
    if (!name) return;
    this.currentSite.components.push({ id: 'comp_' + Date.now(), name, type: section.type, content: JSON.parse(JSON.stringify(section.content)), styles: JSON.parse(JSON.stringify(section.styles)) });
    this.saveSite(); this.renderComponentsList();
    showToast('Saved as component!', 'success');
  },
  insertComponent(compIdx) {
    History.push();
    const comp = this.currentSite.components[compIdx];
    if (!comp) return;
    const g = this.currentSite.globalStyles;
    const newId = 's_' + Date.now();
    const section = { id: newId, type: comp.type, content: JSON.parse(JSON.stringify(comp.content)), styles: JSON.parse(JSON.stringify(comp.styles)), responsive: { tablet: {}, mobile: {} }, animation: { type: 'fadeIn', enabled: true } };
    this.currentSite.sections[newId] = section;
    const page = this.currentSite.pages.find(p => p.id === this.activePage);
    if (page) page.sections.push(newId);
    this.saveSite(); this.renderSite();
    this.scrollToSection(page.sections.length - 1);
    showToast(`Inserted "${comp.name}"`, 'success');
  },
  deleteComponent(idx) {
    if (!confirm('Delete this saved component?')) return;
    this.currentSite.components.splice(idx, 1);
    this.saveSite(); this.renderComponentsList();
    showToast('Component deleted', 'info');
  },
  renderComponentsList() {
    const list = document.getElementById('components-list');
    if (!list || !this.currentSite) return;
    if (this.currentSite.components.length === 0) { list.innerHTML = '<p style="font-size:12px;color:var(--text3)">No saved components yet.</p>'; return; }
    list.innerHTML = this.currentSite.components.map((c, i) =>
      `<div class="block-item" onclick="Editor.insertComponent(${i})" title="Click to insert"><span class="material-icons-round" style="font-size:16px">widgets</span>${c.name}<span class="material-icons-round" style="font-size:12px;position:absolute;top:4px;right:4px;cursor:pointer" onclick="event.stopPropagation();Editor.deleteComponent(${i})">close</span></div>`
    ).join('');
  },

  // ── THEME ──
  setDevice(device) {
    document.querySelectorAll('.device-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-device="${device}"]`)?.classList.add('active');
    const canvas = document.getElementById('editor-canvas');
    canvas.classList.remove('tablet', 'mobile');
    if (device !== 'desktop') canvas.classList.add(device);
  },
  updateTheme() {
    if (!this.currentSite) return;
    History.push();
    const v = id => document.getElementById(id)?.value;
    this.currentSite.globalStyles.colors = { primary: v('theme-primary'), secondary: v('theme-primary'), bg: v('theme-bg'), text: v('theme-text'), accent: v('theme-primary') };
    this.currentSite.globalStyles.typography.headingFont = v('theme-font') || 'Inter';
    this.currentSite.globalStyles.typography.bodyFont = v('theme-font') || 'Inter';
    const spacing = parseInt(v('theme-spacing')) || 80;
    this.currentSite.globalStyles.spacing.sectionPadding = spacing;
    const animation = v('theme-animation') || 'fadeIn';
    this.currentSite.globalStyles.animations.type = animation;
    // Apply to all sections
    Object.values(this.currentSite.sections).forEach(s => {
      s.styles = { ...s.styles, primary: v('theme-primary'), bg: v('theme-bg'), text: v('theme-text'), accent: v('theme-primary') };
      s.animation = { ...s.animation, type: animation };
    });
    this.saveSite(); this.renderSite();
    showToast('Theme updated!', 'success');
  },
  applyPreset(presetKey) { PresetThemes.apply(presetKey); this.syncThemeInputs(); },
  updateStatusBadge() {
    const badge = document.getElementById('site-status-badge');
    if (badge && this.currentSite) {
      const s = this.currentSite.status;
      badge.textContent = s.charAt(0).toUpperCase() + s.slice(1);
      badge.className = 'status-badge status-' + s;
    }
  },

  // ── DRAG ──
  dragStart(e) { this.dragType = e.target.closest('[data-type]').dataset.type; },
  dragOver(e) { e.preventDefault(); document.getElementById('editor-canvas').classList.add('drag-over'); },
  drop(e) {
    e.preventDefault();
    document.getElementById('editor-canvas').classList.remove('drag-over');
    if (!this.dragType || !this.currentSite) return;
    this.addSection(this.dragType);
    this.dragType = null;
  },

  // ── SAVE / PUBLISH ──
  saveSite() {
    const user = Store.get('currentUser');
    if (!user) return;
    const idx = user.sites.findIndex(s => s.id === this.currentSite.id);
    if (idx >= 0) user.sites[idx] = this.currentSite;
    else user.sites.push(this.currentSite);
    Store.set('currentUser', user);
  },
  publish() {
    if (!this.currentSite) return;
    const trial = Auth.checkTrial();
    if (!trial.active) { Modal.open('modal-trial-expired'); return; }
    VersionManager.snapshot();
    const slug = this.currentSite.slug || this.currentSite.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    this.currentSite.published = true;
    this.currentSite.publishedUrl = `https://${slug}.autosite.ai`;
    this.currentSite.status = 'live';
    this.saveSite(); this.updateStatusBadge();
    document.getElementById('published-url').textContent = this.currentSite.publishedUrl;
    document.getElementById('published-url').href = '#';
    document.getElementById('published-frame').innerHTML = Renderer.renderFullSite(this.currentSite);
    App.showPage('page-published');
    showToast('Website published! 🚀', 'success');
  },
  setStatus(status) {
    if (!this.currentSite) return;
    History.push();
    this.currentSite.status = status;
    this.saveSite(); this.updateStatusBadge();
    showToast(`Status: ${status}`, 'info');
  }
};
// ══════════════════ VERSION MANAGER ══════════════════
const VersionManager = {
  snapshot() {
    if (!state.currentSite) return;
    const maxVersions = PlanManager.getLimit('versions');
    const snap = { version: state.currentSite.version, data: JSON.parse(JSON.stringify(state.currentSite)), timestamp: new Date().toISOString() };
    if (!state.currentSite.publishedVersions) state.currentSite.publishedVersions = [];
    state.currentSite.publishedVersions.push(snap);
    if (state.currentSite.publishedVersions.length > maxVersions) state.currentSite.publishedVersions.shift();
    state.currentSite.version++;
    Editor.saveSite();
    this.updateUI();
  },
  rollback(vIdx) {
    if (!state.currentSite || !state.currentSite.publishedVersions[vIdx]) return;
    if (!confirm('Rollback to version ' + state.currentSite.publishedVersions[vIdx].version + '?')) return;
    History.push();
    const old = JSON.parse(JSON.stringify(state.currentSite.publishedVersions[vIdx].data));
    old.publishedVersions = state.currentSite.publishedVersions;
    old.version = state.currentSite.version;
    state.currentSite = old;
    Editor.loadSiteNoHistory(state.currentSite);
    Editor.saveSite();
    showToast('Rolled back!', 'success');
  },
  updateUI() {
    const list = document.getElementById('version-list');
    if (!list || !state.currentSite) return;
    const versions = state.currentSite.publishedVersions || [];
    if (versions.length === 0) { list.innerHTML = '<p style="font-size:12px;color:var(--text3)">No versions yet.</p>'; return; }
    list.innerHTML = versions.map((v, i) =>
      `<div class="version-item" onclick="VersionManager.rollback(${i})"><strong>v${v.version}</strong><small>${new Date(v.timestamp).toLocaleDateString()}</small><span class="material-icons-round" style="font-size:14px">restore</span></div>`
    ).reverse().join('');
  }
};

// ══════════════════ SEO MANAGER ══════════════════
const SEOManager = {
  open() {
    if (!state.currentSite) return;
    const s = state.currentSite.seo;
    document.getElementById('seo-title').value = s.title || '';
    document.getElementById('seo-desc').value = s.description || '';
    document.getElementById('seo-og').value = s.ogImage || '';
    Modal.open('modal-seo');
  },
  save() {
    History.push();
    state.currentSite.seo = {
      title: document.getElementById('seo-title').value,
      description: document.getElementById('seo-desc').value,
      ogImage: document.getElementById('seo-og').value
    };
    Editor.saveSite();
    Modal.close('modal-seo');
    showToast('SEO settings saved!', 'success');
  }
};

// ══════════════════ FORM BUILDER ══════════════════
const FormBuilder = {
  handleSubmit(sectionId) {
    if (!state.currentSite) return;
    const section = state.currentSite.sections[sectionId];
    if (!section) return;
    if (!state.currentSite.forms[sectionId]) state.currentSite.forms[sectionId] = { fields: section.content.fields || [], submissions: [] };
    const sub = { id: 'sub_' + Date.now(), timestamp: new Date().toISOString(), data: {} };
    (section.content.fields || []).forEach(f => { sub.data[f.label] = '(demo data)'; });
    state.currentSite.forms[sectionId].submissions.push(sub);
    Editor.saveSite();
    showToast('Form submitted! (demo)', 'success');
  },
  viewSubmissions() {
    if (!state.currentSite) return;
    const content = document.getElementById('submissions-content');
    const forms = state.currentSite.forms;
    const keys = Object.keys(forms);
    if (keys.length === 0) { content.innerHTML = '<p style="color:var(--text3)">No form submissions yet.</p>'; }
    else {
      content.innerHTML = keys.map(k => {
        const f = forms[k];
        return `<h4 style="margin-bottom:8px">${k}</h4>` +
          (f.submissions.length === 0 ? '<p style="color:var(--text3)">No submissions</p>' :
            `<table style="width:100%;font-size:13px;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:8px;border-bottom:1px solid var(--border)">Date</th>${Object.keys(f.submissions[0].data).map(h => `<th style="text-align:left;padding:8px;border-bottom:1px solid var(--border)">${h}</th>`).join('')}</tr></thead><tbody>${f.submissions.map(s => `<tr><td style="padding:8px;border-bottom:1px solid var(--border)">${new Date(s.timestamp).toLocaleString()}</td>${Object.values(s.data).map(v => `<td style="padding:8px;border-bottom:1px solid var(--border)">${v}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      }).join('<hr style="margin:16px 0">');
    }
    Modal.open('modal-submissions');
  }
};

// ══════════════════ COLLABORATION ══════════════════
const Collaboration = {
  commentMode: false,
  toggleCommentMode() {
    if (!PlanManager.hasFeature('collaboration')) { showToast('Upgrade to Agency for collaboration', 'error'); return; }
    this.commentMode = !this.commentMode;
    document.getElementById('editor-canvas').classList.toggle('comment-mode', this.commentMode);
    document.getElementById('btn-comment-mode')?.classList.toggle('active', this.commentMode);
    showToast(this.commentMode ? 'Comment mode ON — click canvas to add' : 'Comment mode OFF', 'info');
  },
  addComment(e) {
    if (!this.commentMode || !state.currentSite) return;
    const canvas = document.getElementById('editor-canvas');
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width * 100).toFixed(1);
    const y = ((e.clientY - rect.top + canvas.scrollTop) / canvas.scrollHeight * 100).toFixed(1);
    const text = prompt('Add comment:');
    if (!text) return;
    state.currentSite.collaboration.comments.push({ id: 'c_' + Date.now(), x, y, text, author: 'You', timestamp: new Date().toISOString() });
    Editor.saveSite(); this.renderPins();
  },
  renderPins() {
    document.querySelectorAll('.comment-pin').forEach(p => p.remove());
    if (!state.currentSite) return;
    const canvas = document.getElementById('editor-canvas');
    state.currentSite.collaboration.comments.forEach((c, i) => {
      const pin = document.createElement('div');
      pin.className = 'comment-pin';
      pin.style.cssText = `left:${c.x}%;top:${c.y}%;`;
      pin.title = `${c.author}: ${c.text}`;
      pin.textContent = (i + 1);
      pin.onclick = (e) => { e.stopPropagation(); alert(`${c.author}: ${c.text}`); };
      canvas.appendChild(pin);
    });
  },
  getShareLink() {
    if (!state.currentSite) return;
    const link = `https://autosite.ai/preview/${state.currentSite.collaboration.shareId}`;
    navigator.clipboard?.writeText(link);
    showToast('Share link copied!', 'success');
  }
};

// ══════════════════ ANALYTICS ══════════════════
const AnalyticsModule = {
  init() {
    const el = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    if (state.currentSite) {
      const a = state.currentSite.analytics;
      a.visitors = a.visitors || Math.floor(a.views * 0.6);
      el('stat-views', a.views.toLocaleString('en-IN'));
      el('stat-visitors', a.visitors.toLocaleString('en-IN'));
      el('stat-clicks', Math.floor(a.views * 0.15).toLocaleString('en-IN'));
      el('stat-time', Math.floor(Math.random() * 120 + 30) + 's');
    } else {
      el('stat-views', '0'); el('stat-visitors', '0'); el('stat-clicks', '0'); el('stat-time', '0s');
    }
    this.renderChart();
  },
  renderChart() {
    const chart = document.getElementById('chart-bars');
    if (!chart) return;
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    chart.innerHTML = days.map(d => {
      const h = Math.floor(Math.random() * 80 + 20);
      return `<div class="chart-col"><div class="chart-bar" style="height:${h}%"></div><small>${d}</small></div>`;
    }).join('');
  },
  trackEvent(type, data) {
    if (!state.currentSite) return;
    state.currentSite.analytics.interactions.push({ type, data, timestamp: new Date().toISOString() });
    Editor.saveSite();
  }
};

// ══════════════════ AI CHAT ══════════════════
const AIChat = {
  send() {
    const input = document.getElementById('ai-chat-input');
    const text = input.value.trim();
    if (!text) return;
    this.addMessage(text, 'user');
    input.value = '';
    setTimeout(() => { const reply = this.parseCommand(text); this.addMessage(reply, 'ai'); }, 300);
  },
  addMessage(text, role) {
    const box = document.getElementById('ai-chat-messages');
    const msg = document.createElement('div');
    msg.className = 'chat-msg ' + role;
    msg.innerHTML = text;
    box.appendChild(msg);
    box.scrollTop = box.scrollHeight;
  },
  parseCommand(text) {
    if (!Editor.currentSite) return 'No site loaded.';
    const t = text.toLowerCase();
    const site = Editor.currentSite;

    // ── Theme presets ──
    const presetNames = PresetThemes.getList();
    for (const p of presetNames) {
      if (t.includes(p) && (t.includes('theme') || t.includes('style') || t.includes('preset') || t.includes('make it') || t.includes('switch'))) {
        Editor.applyPreset(p);
        return `✓ Applied "${p}" preset. JSON updated & re-rendered.`;
      }
    }
    // ── Dark/light mode ──
    if (t.includes('dark') && (t.includes('theme') || t.includes('mode') || t.includes('background'))) {
      History.push();
      site.globalStyles.colors.bg = '#000000'; site.globalStyles.colors.text = '#ffffff';
      Object.values(site.sections).forEach(s => { s.styles.bg = '#000'; s.styles.text = '#fff'; });
      Editor.saveSite(); Editor.renderSite();
      return '✓ Dark mode applied.';
    }
    if (t.includes('light') && (t.includes('theme') || t.includes('mode') || t.includes('background'))) {
      History.push();
      site.globalStyles.colors.bg = '#ffffff'; site.globalStyles.colors.text = '#111111';
      Object.values(site.sections).forEach(s => { s.styles.bg = '#fff'; s.styles.text = '#111'; });
      Editor.saveSite(); Editor.renderSite();
      return '✓ Light mode applied.';
    }
    // ── Color change ──
    const colorMatch = t.match(/(?:color|primary|accent)\s+(?:to\s+)?([#]?[a-f0-9]{3,8}|red|blue|green|purple|orange|pink|teal|gold)/i);
    if (colorMatch) {
      const colorMap = { red: '#e74c3c', blue: '#3498db', green: '#2ecc71', purple: '#9b59b6', orange: '#e67e22', pink: '#FF6B9D', teal: '#1abc9c', gold: '#C9A96E' };
      const color = colorMap[colorMatch[1].toLowerCase()] || (colorMatch[1].startsWith('#') ? colorMatch[1] : '#' + colorMatch[1]);
      History.push();
      site.globalStyles.colors.primary = color; site.globalStyles.colors.accent = color;
      Object.values(site.sections).forEach(s => { s.styles.primary = color; s.styles.accent = color; });
      Editor.saveSite(); Editor.renderSite(); Editor.syncThemeInputs();
      return `✓ Primary color → ${color}.`;
    }
    // ── Font ──
    const fontMatch = t.match(/font\s+(?:to\s+)?([\w\s]+)/i);
    if (fontMatch && !t.includes('bigger') && !t.includes('smaller') && !t.includes('size')) {
      History.push();
      const font = fontMatch[1].trim();
      site.globalStyles.typography.headingFont = font; site.globalStyles.typography.bodyFont = font;
      Editor.saveSite(); Editor.renderSite(); Editor.syncThemeInputs();
      return `✓ Font → ${font}.`;
    }
    // ── Voice rewriting ──
    const voiceMatch = t.match(/rewrite\s+(?:the\s+)?(?:(.+?)\s+)?in\s+(professional|friendly|luxury|startup)\s*(?:voice|tone)?/i);
    if (voiceMatch) {
      const target = voiceMatch[1]?.toLowerCase() || 'hero';
      const voice = voiceMatch[2].toLowerCase();
      const section = Object.values(site.sections).find(s => s.type === target) || Object.values(site.sections)[0];
      if (section && section.content.heading) {
        History.push();
        const alts = AIEngine.rewriteInVoice(section.content.heading, voice);
        section.content.heading = alts[0];
        if (section.content.subheading) {
          const subAlts = AIEngine.rewriteInVoice(section.content.subheading, voice);
          section.content.subheading = subAlts[0];
        }
        Editor.saveSite(); Editor.renderSite();
        return `✓ Rewrote ${section.type} in ${voice} voice.`;
      }
      return 'Could not find section to rewrite.';
    }
    // ── Add sections ──
    const sectionTypes = ['hero', 'features', 'about', 'gallery', 'testimonials', 'pricing', 'contact', 'form', 'cta', 'footer'];
    for (const st of sectionTypes) {
      if (t.includes('add') && t.includes(st)) { Editor.addSection(st); return `✓ Added ${st} section.`; }
    }
    // ── Remove sections ──
    if (t.includes('remove') || t.includes('delete')) {
      const page = site.pages.find(p => p.id === Editor.activePage);
      if (t.includes('last') && page.sections.length > 0) {
        History.push();
        const sid = page.sections.pop(); delete site.sections[sid];
        Editor.saveSite(); Editor.renderSite();
        return '✓ Removed last section.';
      }
      if (t.includes('first') && page.sections.length > 0) {
        History.push();
        const sid = page.sections.shift(); delete site.sections[sid];
        Editor.saveSite(); Editor.renderSite();
        return '✓ Removed first section.';
      }
      for (const st of sectionTypes) {
        if (t.includes(st)) {
          const sid = Object.keys(site.sections).find(k => site.sections[k].type === st);
          if (sid) { History.push(); page.sections = page.sections.filter(s => s !== sid); delete site.sections[sid]; Editor.saveSite(); Editor.renderSite(); return `✓ Removed ${st} section.`; }
        }
      }
    }
    // ── Rename ──
    if (t.includes('rename') && t.includes('to')) {
      const newName = text.substring(text.toLowerCase().indexOf('to') + 3).trim();
      if (newName) { History.push(); site.name = newName; document.getElementById('editor-site-name').textContent = newName; Editor.saveSite(); return `✓ Renamed to "${newName}".`; }
    }
    // ── Change heading ──
    const headingMatch = text.match(/(?:change|set|update)\s+(?:the\s+)?(?:(\w+)\s+)?heading\s+to\s+["']?(.+?)["']?$/i);
    if (headingMatch) {
      const target = headingMatch[1]?.toLowerCase() || 'hero';
      const s = Object.values(site.sections).find(x => x.type === target);
      if (s) { History.push(); s.content.heading = headingMatch[2]; Editor.saveSite(); Editor.renderSite(); return `✓ ${target} heading updated.`; }
    }
    // ── Change subheading ──
    const subMatch = text.match(/(?:change|set|update)\s+(?:the\s+)?subheading\s+to\s+["']?(.+?)["']?$/i);
    if (subMatch) {
      const s = Object.values(site.sections).find(x => x.type === 'hero');
      if (s) { History.push(); s.content.subheading = subMatch[1]; Editor.saveSite(); Editor.renderSite(); return '✓ Subheading updated.'; }
    }
    // ── Layout suggestion ──
    if (t.includes('suggest') || t.includes('improve') || t.includes('recommendation')) {
      const types = Object.values(site.sections).map(s => s.type);
      const suggestions = [];
      if (!types.includes('testimonials')) suggestions.push('• Add a testimonials section for social proof');
      if (!types.includes('cta')) suggestions.push('• Add a CTA section to drive conversions');
      if (!types.includes('pricing')) suggestions.push('• Add pricing to reduce friction');
      if (!types.includes('footer')) suggestions.push('• Add a footer for navigation');
      if (types.length < 4) suggestions.push('• Consider adding more sections for a richer page');
      suggestions.push('• Try "rewrite hero in luxury voice" for premium feel');
      suggestions.push('• Try "apply elegant theme" for a polished look');
      return suggestions.length ? '💡 Suggestions:\n' + suggestions.join('\n') : 'Your site looks great! No suggestions.';
    }
    return 'Try: "switch to dark", "color to teal", "add pricing", "rewrite hero in luxury voice", "suggest improvements"';
  }
};

// ══════════════════ CONTENT REWRITER ══════════════════
const ContentRewriter = {
  attachButtons() {
    document.querySelectorAll('.editor-section [contenteditable="true"]').forEach(el => {
      if (el.dataset.rewriterAttached) return;
      el.dataset.rewriterAttached = 'true';
      const wrapper = document.createElement('span');
      wrapper.className = 'rewriter-wrap';
      wrapper.style.position = 'relative';
      el.parentNode.insertBefore(wrapper, el);
      wrapper.appendChild(el);
      const btn = document.createElement('button');
      btn.className = 'rewriter-trigger';
      btn.innerHTML = '<span class="material-icons-round" style="font-size:14px">auto_awesome</span>';
      btn.title = 'AI Rewrite';
      btn.onclick = (e) => { e.stopPropagation(); this.showPopup(el); };
      wrapper.appendChild(btn);
    });
  },
  showPopup(el) {
    const popup = document.getElementById('rewriter-popup');
    const rect = el.getBoundingClientRect();
    popup.style.top = (rect.bottom + 8) + 'px';
    popup.style.left = rect.left + 'px';
    popup.style.display = 'block';
    const original = el.textContent;
    const voices = ['professional', 'friendly', 'luxury', 'startup'];
    document.getElementById('rewriter-variations').innerHTML = voices.map(v => {
      const alts = AIEngine.rewriteInVoice(original, v);
      return `<div class="rewriter-voice"><strong>${v}</strong>${alts.map(a => `<div class="rewriter-option" onclick="ContentRewriter.apply(this,'${v}')">${a}</div>`).join('')}</div>`;
    }).join('');
    this._activeEl = el;
  },
  apply(optionEl, voice) {
    if (this._activeEl) {
      History.push();
      this._activeEl.textContent = optionEl.textContent;
      // Save back to JSON
      const section = this._activeEl.closest('.editor-section');
      if (section) {
        const sid = section.dataset.sid;
        const s = state.currentSite?.sections[sid];
        if (s) {
          if (this._activeEl.tagName === 'H1' || this._activeEl.tagName === 'H2') s.content.heading = optionEl.textContent;
          else if (this._activeEl.tagName === 'P') { if (s.content.subheading) s.content.subheading = optionEl.textContent; else if (s.content.text) s.content.text = optionEl.textContent; }
          Editor.saveSite();
        }
      }
    }
    this.hidePopup();
    showToast(`Rewritten in ${voice} voice`, 'success');
  },
  hidePopup() { document.getElementById('rewriter-popup').style.display = 'none'; }
};

// ══════════════════ SITE TIMER & FREEZE SYSTEM ══════════════════
const SiteTimer = {
  TRIAL_DAYS: 30,
  getDaysLeft(site) {
    if (!site?.createdAt) return this.TRIAL_DAYS;
    const created = new Date(site.createdAt).getTime();
    const now = Date.now();
    const elapsed = Math.floor((now - created) / (1000 * 60 * 60 * 24));
    return Math.max(0, this.TRIAL_DAYS - elapsed);
  },
  getProgress(site) {
    const left = this.getDaysLeft(site);
    return ((this.TRIAL_DAYS - left) / this.TRIAL_DAYS) * 100;
  },
  isFrozen(site) {
    if (!site) return false;
    const user = Store.get('currentUser');
    if (this.hasActiveSubscription(user)) return false;
    return this.getDaysLeft(site) <= 0;
  },
  hasActiveSubscription(user) {
    if (!user) return false;
    if (user.subscriptionEnd) {
      return new Date(user.subscriptionEnd).getTime() > Date.now();
    }
    return false;
  },
  freezeCheck(user) {
    if (!user?.sites) return;
    let changed = false;
    user.sites.forEach(s => {
      const wasFrozen = s.frozen || false;
      s.frozen = this.isFrozen(s);
      if (s.frozen !== wasFrozen) changed = true;
    });
    if (changed) Store.set('currentUser', user);
  },
  unfreezeAll(user) {
    if (!user?.sites) return;
    user.sites.forEach(s => { s.frozen = false; });
    Store.set('currentUser', user);
  },
  getBadgeColor(daysLeft) {
    if (daysLeft > 15) return '#2ecc71';
    if (daysLeft > 5) return '#f39c12';
    return '#e74c3c';
  }
};

// ══════════════════ PLAN MANAGER ══════════════════
const PlanManager = {
  plans: {
    trial: { pages: 3, sites: 2, versions: 3, components: false, analytics: false, collaboration: false, codeExport: false, formBuilder: 'basic', customDomain: false, presetThemes: 2 },
    starter: { pages: 3, sites: 3, versions: 3, components: false, analytics: false, collaboration: false, codeExport: false, formBuilder: 'basic', customDomain: false, presetThemes: 2 },
    pro: { pages: 10, sites: 10, versions: 10, components: false, analytics: true, collaboration: false, codeExport: false, formBuilder: 'full', customDomain: true, presetThemes: 99 },
    agency: { pages: 999, sites: 999, versions: 999, components: true, analytics: true, collaboration: true, codeExport: true, formBuilder: 'full', customDomain: true, presetThemes: 99 }
  },
  // INR pricing per month
  pricing: { starter: 100, pro: 200, agency: 300 },
  // Billing period multipliers
  billingMultipliers: { monthly: { factor: 1, days: 30, label: '/mo' }, quarterly: { factor: 2.7, days: 90, label: '/qtr', discount: '10% off' }, yearly: { factor: 9, days: 365, label: '/yr', discount: '25% off' } },
  getLimit(key) { return this.plans[state.plan]?.[key] || this.plans.trial[key]; },
  hasFeature(key) { return !!this.plans[state.plan]?.[key]; },
  applyPlanFeatures() {
    const plan = this.plans[state.plan] || this.plans.trial;
    const dl = document.getElementById('btn-download-code');
    if (dl) dl.classList.toggle('hidden', !plan.codeExport);
    const ce = document.getElementById('btn-comment-mode');
    if (ce) ce.classList.toggle('hidden', !plan.collaboration);
  },
  selectPlan(planId, period) {
    period = period || state.billingPeriod || 'monthly';
    const user = Store.get('currentUser');
    if (!user) return;
    // ── Additive Grace Period ──
    let bonusDays = 0;
    if (user.sites?.length > 0) {
      const maxRemaining = Math.max(...user.sites.map(s => SiteTimer.getDaysLeft(s)));
      if (maxRemaining > 0) bonusDays = maxRemaining;
    }
    const periodDays = this.billingMultipliers[period]?.days || 30;
    const totalDays = periodDays + bonusDays;
    const subEnd = new Date(Date.now() + totalDays * 24 * 60 * 60 * 1000).toISOString();
    user.plan = planId;
    user.subscriptionEnd = subEnd;
    Store.set('currentUser', user);
    state.plan = planId;
    // Unfreeze all sites
    SiteTimer.unfreezeAll(user);
    const msg = bonusDays > 0
      ? `Upgraded to ${planId}! 🎉 ${bonusDays} bonus days added (${totalDays} total)`
      : `Upgraded to ${planId}! 🎉 ${totalDays} days of access`;
    showToast(msg, 'success');
    Modal.close('modal-upgrade');
    this.applyPlanFeatures();
    Dashboard.renderSites();
  },
  downloadCode() {
    if (!this.hasFeature('codeExport')) { showToast('Upgrade to Agency for code export', 'error'); return; }
    if (!state.currentSite) return;
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${state.currentSite.seo.title || state.currentSite.name}</title><meta name="description" content="${state.currentSite.seo.description || ''}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:${state.currentSite.globalStyles.typography.headingFont},sans-serif}</style></head><body>${Renderer.renderFullSite(state.currentSite)}</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (state.currentSite.slug || 'site') + '.html';
    a.click();
    showToast('Code downloaded!', 'success');
  }
};

// ══════════════════ DASHBOARD ══════════════════
const Dashboard = {
  init() {
    const user = Store.get('currentUser');
    if (!user) return;
    document.getElementById('user-name-display').textContent = user.name;
    document.getElementById('user-avatar').textContent = user.name.charAt(0).toUpperCase();
    // Update trial widget based on subscription
    const hasSub = SiteTimer.hasActiveSubscription(user);
    if (hasSub || user.plan !== 'trial') {
      document.getElementById('trial-widget').style.display = 'none';
    } else {
      const trial = Auth.checkTrial();
      document.getElementById('trial-days').textContent = trial.days;
      document.getElementById('trial-bar-fill').style.width = ((30 - trial.days) / 30 * 100) + '%';
    }
    // Update subscription tab info
    const planNameEl = document.getElementById('current-plan-name');
    const trialEndEl = document.getElementById('trial-end-date');
    const planDescEl = document.getElementById('current-plan-desc');
    if (planNameEl) planNameEl.textContent = user.plan === 'trial' ? 'Free Trial' : user.plan.charAt(0).toUpperCase() + user.plan.slice(1);
    if (trialEndEl && planDescEl) {
      if (hasSub && user.subscriptionEnd) {
        const endDate = new Date(user.subscriptionEnd);
        trialEndEl.textContent = endDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        planDescEl.innerHTML = `Your subscription renews on <span id="trial-end-date">${trialEndEl.textContent}</span>`;
      } else {
        // Calculate trial end from signup date or earliest site
        const signupDate = Store.get('signupDate');
        if (signupDate) {
          const endDate = new Date(new Date(signupDate).getTime() + 30 * 24 * 60 * 60 * 1000);
          trialEndEl.textContent = endDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        } else if (user.sites?.length > 0) {
          const earliest = user.sites.reduce((min, s) => s.createdAt < min ? s.createdAt : min, user.sites[0].createdAt);
          const endDate = new Date(new Date(earliest).getTime() + 30 * 24 * 60 * 60 * 1000);
          trialEndEl.textContent = endDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        }
      }
    }
    SiteTimer.freezeCheck(user);
    this.renderSites();
    AnalyticsModule.init();
    this.renderPricing();
    document.getElementById('settings-name').value = user.name;
    document.getElementById('settings-email').value = user.email;
    if (window.lucide) lucide.createIcons();
  },
  renderSites() {
    const user = Store.get('currentUser');
    const grid = document.getElementById('sites-grid');
    const empty = document.getElementById('empty-sites');
    if (!user || user.sites.length === 0) { grid.innerHTML = ''; empty.style.display = ''; return; }
    empty.style.display = 'none';
    grid.innerHTML = user.sites.map((s, i) => {
      const daysLeft = SiteTimer.getDaysLeft(s);
      const frozen = SiteTimer.isFrozen(s);
      const progress = SiteTimer.getProgress(s);
      const badgeColor = SiteTimer.getBadgeColor(daysLeft);
      const previewSection = Object.values(s.sections)[0] || { type: 'hero', content: { heading: s.name, subheading: '', cta: '' }, styles: { primary: '#6C5CE7', bg: '#0a0a1a', text: '#fff', accent: '#00D2FF' } };
      return `<div class="site-card${frozen ? ' frozen' : ''}">
        <div class="site-card-preview">${Renderer.renderSection(previewSection, false)}
          ${frozen ? '<div class="frozen-overlay"><span class="material-icons-round" style="font-size:40px">lock</span><p>Frozen</p></div>' : ''}
        </div>
        <div class="site-card-info">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
            <h4>${s.name}</h4>
            <span class="countdown-badge" style="background:${badgeColor}20;color:${badgeColor};border:1px solid ${badgeColor}40">
              ${frozen ? '🔒 Frozen' : daysLeft + 'd left'}
            </span>
          </div>
          <div class="freeze-bar"><div class="freeze-bar-fill" style="width:${progress}%;background:${badgeColor}"></div></div>
          <small>${s.status || 'draft'} · v${s.version || 1}</small>
          <div class="site-card-actions">
            ${frozen
          ? '<button class="btn btn-primary btn-sm btn-block" onclick="Dashboard.showUpgrade()"><span class="material-icons-round" style="font-size:14px">lock_open</span> Upgrade to Unfreeze</button>'
          : `<button class="btn btn-primary btn-sm" onclick="Editor.loadSite(Store.get('currentUser').sites[${i}]);App.showPage('page-editor')">Edit</button><button class="btn btn-ghost btn-sm" onclick="Dashboard.deleteSite(${i})">Delete</button>`
        }
          </div>
        </div>
      </div>`;
    }).join('');
  },
  deleteSite(idx) {
    if (!confirm('Delete this site?')) return;
    const user = Store.get('currentUser');
    user.sites.splice(idx, 1);
    Store.set('currentUser', user);
    this.renderSites();
    showToast('Site deleted', 'info');
  },
  switchTab(el) {
    document.querySelectorAll('.dash-link').forEach(l => l.classList.remove('active'));
    el.classList.add('active');
    document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(el.dataset.tab)?.classList.add('active');
    if (el.dataset.tab === 'dash-analytics') AnalyticsModule.init();
  },
  renderPricing() {
    const fmt = v => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(v);
    const period = state.billingPeriod || 'monthly';
    const mult = PlanManager.billingMultipliers[period];
    const base = PlanManager.pricing;
    const plans = [
      { id: 'starter', name: 'Starter', price: fmt(Math.round(base.starter * mult.factor)), sites: '3 Sites', features: ['3 Pages', 'Basic Editor', 'Free Subdomain', 'SSL', '3 Versions'] },
      { id: 'pro', name: 'Pro', price: fmt(Math.round(base.pro * mult.factor)), sites: '10 Sites', features: ['10 Pages', 'Full Editor', 'Custom Domain', 'Analytics', '10 Versions', 'All Themes'] },
      { id: 'agency', name: 'Agency', price: fmt(Math.round(base.agency * mult.factor)), sites: 'Unlimited Sites', features: ['Unlimited Pages', 'Code Export', 'Collaboration', 'Components', 'Unlimited Versions', 'Custom Domains'] }
    ];
    const toggleHtml = `<div class="billing-toggle">
      <button class="billing-btn${period === 'monthly' ? ' active' : ''}" onclick="Dashboard.setBilling('monthly')">Monthly</button>
      <button class="billing-btn${period === 'quarterly' ? ' active' : ''}" onclick="Dashboard.setBilling('quarterly')">Quarterly <small>-10%</small></button>
      <button class="billing-btn${period === 'yearly' ? ' active' : ''}" onclick="Dashboard.setBilling('yearly')">Yearly <small>-25%</small></button>
    </div>`;
    const cardsHtml = plans.map(p =>
      `<div class="pricing-card" onmousemove="Dashboard.trackGlow(event,this)" onmouseleave="Dashboard.resetGlow(this)">
        <div class="pricing-glow"></div>
        <div class="pricing-name">${p.name}</div>
        <div class="pricing-price">${p.price}<span>${mult.label}</span></div>
        <div class="pricing-sites">${p.sites}</div>
        <ul class="pricing-features">${p.features.map(f => `<li>✓ ${f}</li>`).join('')}</ul>
        <button class="btn btn-outline btn-block" onclick="PlanManager.selectPlan('${p.id}','${period}')">${state.plan === p.id ? 'Current Plan' : 'Choose Plan'}</button>
      </div>`
    ).join('');
    const fullHtml = toggleHtml + '<div class="pricing-grid compact">' + cardsHtml + '</div>';
    const up = document.getElementById('upgrade-pricing'); if (up) up.innerHTML = fullHtml;
    const dp = document.getElementById('dash-pricing'); if (dp) dp.innerHTML = fullHtml;
  },
  setBilling(period) {
    state.billingPeriod = period;
    this.renderPricing();
  },
  trackGlow(e, card) {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty('--mx', x + 'px');
    card.style.setProperty('--my', y + 'px');
  },
  resetGlow(card) {
    card.style.removeProperty('--mx');
    card.style.removeProperty('--my');
  },
  showUpgrade() { this.renderPricing(); Modal.open('modal-upgrade'); },
  saveSettings() {
    const user = Store.get('currentUser');
    user.name = document.getElementById('settings-name').value;
    Store.set('currentUser', user);
    showToast('Settings saved!', 'success');
  }
};

// ══════════════════ TRIAL MANAGER (legacy compat) ══════════════════
const TrialManager = {
  checkEditorAccess() {
    if (!state.currentSite) return;
    const frozen = SiteTimer.isFrozen(state.currentSite);
    const overlay = document.getElementById('editor-trial-overlay');
    if (overlay) overlay.style.display = frozen ? 'flex' : 'none';
  }
};

// ══════════════════ VERIFICATION ══════════════════
const Verification = {
  code: '',
  open(email) {
    this.code = String(Math.floor(100000 + Math.random() * 900000));
    const msg = document.getElementById('verify-email-msg');
    if (msg) msg.textContent = `Code sent to ${email || 'your email'}: ${this.code}`;
    document.querySelectorAll('.verify-code-input').forEach(i => i.value = '');
    Modal.open('modal-verify');
    setTimeout(() => {
      const inputs = document.querySelectorAll('.verify-code-input');
      this.code.split('').forEach((d, i) => { if (inputs[i]) inputs[i].value = d; });
    }, 1500);
  },
  autoFocus(el) { if (el.value && el.nextElementSibling) el.nextElementSibling.focus(); },
  confirm() {
    const entered = Array.from(document.querySelectorAll('.verify-code-input')).map(i => i.value).join('');
    if (entered === this.code) {
      state.isVerified = true;
      Store.set('isVerified', true);
      if (!Store.get('signupDate')) Store.set('signupDate', new Date().toISOString());
      Modal.close('modal-verify');
      showToast('Email verified! ✅', 'success');
      App.showPage('page-dashboard');
    } else { showToast('Invalid code', 'error'); }
  },
  resend() { showToast(`Code resent: ${this.code}`, 'info'); }
};

// ══════════════════ INIT ══════════════════
document.addEventListener('DOMContentLoaded', () => {
  const verify = Store.get('isVerified');
  if (verify) state.isVerified = true;
  const user = Store.get('currentUser');
  if (user) state.plan = user.plan || 'trial';
  // Hero preview animation
  const preview = document.getElementById('hero-preview-body');
  if (preview) {
    preview.innerHTML = `<div style="padding:40px;background:#0a0a1a;min-height:200px"><div style="height:16px;background:linear-gradient(90deg,var(--primary),var(--accent));border-radius:8px;width:70%;margin-bottom:16px"></div><div style="height:10px;background:#ffffff15;border-radius:4px;width:90%;margin-bottom:8px"></div><div style="height:10px;background:#ffffff10;border-radius:4px;width:60%;margin-bottom:24px"></div><div style="display:flex;gap:12px"><div style="padding:10px 28px;background:var(--gradient);border-radius:8px"></div><div style="padding:10px 28px;border:1px solid #ffffff20;border-radius:8px"></div></div></div>`;
  }
  // Comment mode click handler
  document.getElementById('editor-canvas')?.addEventListener('click', (e) => Collaboration.addComment(e));
  // Initialize Deep Edit (AI text/image tools)
  DeepEdit.init();
  if (window.lucide) lucide.createIcons();
});


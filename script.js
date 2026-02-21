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
      App.showPage('page-onboarding'); Onboard.reset();
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
          const site = AIEngine.generate(this.data);
          const user = Store.get('currentUser');
          if (user) { user.sites.push(site); Store.set('currentUser', user); }
          state.currentSite = site;
          Editor.loadSite(site);
          App.showPage('page-editor');
          showToast('Website generated! 🎉', 'success');
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
    const sectionsArr = tplFn.call(this, prompt, theme);
    const sectionsMap = {};
    sectionsArr.forEach(s => { sectionsMap[s.id] = s; });
    const sectionIds = sectionsArr.map(s => s.id);

    return {
      id: 'site_' + Date.now(),
      name: this.extractName(prompt, bizType),
      slug: this.extractName(prompt, bizType).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      version: 1,
      status: 'draft',
      seo: { title: this.extractName(prompt, bizType), description: prompt.substring(0, 160), ogImage: '' },
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
  businessTpl(p, t) {
    return [
      this._s('s1', 'hero', { heading: 'Elevate Your Business', subheading: 'We deliver innovative solutions that drive growth and transform your digital presence.', cta: 'Get Started', cta2: 'Learn More' }, t),
      this._s('s2', 'features', { heading: 'Why Choose Us', items: [{ icon: '🚀', title: 'Fast Performance', desc: 'Lightning-fast loading speeds.' }, { icon: '🔒', title: 'Enterprise Security', desc: 'Bank-grade security.' }, { icon: '📈', title: 'Growth Analytics', desc: 'Data-driven insights.' }, { icon: '🤝', title: '24/7 Support', desc: 'Always here to help.' }] }, t),
      this._s('s3', 'about', { heading: 'About Our Company', text: 'We are a team of passionate innovators dedicated to helping businesses thrive in the digital age.', image: '🏢' }, t),
      this._s('s4', 'testimonials', { heading: 'What Our Clients Say', items: [{ name: 'Sarah J.', role: 'CEO', text: 'Incredible results!', avatar: '👩‍💼' }, { name: 'Mike C.', role: 'Founder', text: 'Best investment ever!', avatar: '👨‍💻' }] }, t),
      this._s('s5', 'cta', { heading: 'Ready to Get Started?', subheading: 'Join thousands of successful businesses.', cta: 'Start Free Trial' }, t),
      this._s('s6', 'footer', { brand: 'Business Pro', links: ['About', 'Services', 'Contact', 'Privacy'] }, t)
    ];
  },
  portfolioTpl(p, t) {
    return [
      this._s('s1', 'hero', { heading: 'Creative Portfolio', subheading: 'Showcasing exceptional design and creative excellence.', cta: 'View Work', cta2: 'Contact Me' }, t),
      this._s('s2', 'gallery', { heading: 'Featured Work', items: ['🎨 Brand Design', '📱 Mobile App', '🌐 Website', '📹 Video', '🖼️ Illustration', '📸 Photography'] }, t),
      this._s('s3', 'about', { heading: 'About Me', text: 'Multidisciplinary designer passionate about beautiful, functional experiences.', image: '🎭' }, t),
      this._s('s4', 'contact', { heading: 'Let\'s Connect', subheading: 'Have a project? I\'d love to hear about it.' }, t),
      this._s('s5', 'footer', { brand: 'Portfolio', links: ['Work', 'About', 'Contact', 'Instagram'] }, t)
    ];
  },
  ecommerceTpl(p, t) {
    return [
      this._s('s1', 'hero', { heading: 'Shop the Latest Collection', subheading: 'Premium products curated just for you.', cta: 'Shop Now', cta2: 'New Arrivals' }, t),
      this._s('s2', 'features', { heading: 'Featured Products', items: [{ icon: '👟', title: 'Premium Sneakers', desc: 'Starting at $89.' }, { icon: '👜', title: 'Designer Bags', desc: 'Handcrafted luxury.' }, { icon: '⌚', title: 'Smart Watches', desc: 'Next-gen wearables.' }, { icon: '🎧', title: 'Audio Gear', desc: 'Studio-quality sound.' }] }, t),
      this._s('s3', 'testimonials', { heading: 'Customer Reviews', items: [{ name: 'Alex R.', role: 'Buyer', text: 'Amazing quality!', avatar: '🧑' }, { name: 'Priya P.', role: 'Buyer', text: 'Best shopping experience.', avatar: '👩' }] }, t),
      this._s('s4', 'cta', { heading: 'Get 20% Off First Order', subheading: 'Sign up and save.', cta: 'Subscribe' }, t),
      this._s('s5', 'footer', { brand: 'ShopSite', links: ['Products', 'About', 'FAQ', 'Returns'] }, t)
    ];
  },
  blogTpl(p, t) {
    return [
      this._s('s1', 'hero', { heading: 'Welcome to My Blog', subheading: 'Thoughts, stories, and ideas worth sharing.', cta: 'Read Latest', cta2: 'Subscribe' }, t),
      this._s('s2', 'features', { heading: 'Recent Posts', items: [{ icon: '📝', title: 'The Future of AI', desc: 'How AI reshapes industries.' }, { icon: '💡', title: 'Design Thinking', desc: 'Solving problems creatively.' }, { icon: '🌍', title: 'Remote Work', desc: '10 productivity strategies.' }, { icon: '📚', title: 'Book Reviews', desc: 'Top growth picks.' }] }, t),
      this._s('s3', 'cta', { heading: 'Never Miss a Post', subheading: 'Subscribe for weekly updates.', cta: 'Subscribe Now' }, t),
      this._s('s4', 'footer', { brand: 'BlogSite', links: ['Articles', 'About', 'Newsletter', 'RSS'] }, t)
    ];
  },
  restaurantTpl(p, t) {
    return [
      this._s('s1', 'hero', { heading: 'Fine Dining Experience', subheading: 'Exquisite cuisine crafted with passion.', cta: 'Reserve a Table', cta2: 'View Menu' }, t),
      this._s('s2', 'features', { heading: 'Our Menu', items: [{ icon: '🥗', title: 'Starters', desc: 'Fresh salads & appetizers.' }, { icon: '🥩', title: 'Main Course', desc: 'Premium steaks & seafood.' }, { icon: '🍷', title: 'Wine Selection', desc: 'Curated fine wines.' }, { icon: '🍰', title: 'Desserts', desc: 'Handcrafted sweets.' }] }, t),
      this._s('s3', 'about', { heading: 'Our Story', text: 'Combining traditional techniques with modern creativity since 2010.', image: '🍽️' }, t),
      this._s('s4', 'contact', { heading: 'Make a Reservation', subheading: 'Book your table today.' }, t),
      this._s('s5', 'footer', { brand: 'Restaurant', links: ['Menu', 'Reservations', 'Events', 'Contact'] }, t)
    ];
  },
  saasTpl(p, t) {
    return [
      this._s('s1', 'hero', { heading: 'Scale Your Business Faster', subheading: 'The all-in-one platform for productivity.', cta: 'Start Free Trial', cta2: 'View Demo' }, t),
      this._s('s2', 'features', { heading: 'Powerful Features', items: [{ icon: '⚡', title: 'Lightning Fast', desc: 'Sub-second response.' }, { icon: '🔄', title: 'Automation', desc: 'Automate repetitive tasks.' }, { icon: '📊', title: 'Analytics', desc: 'Real-time dashboards.' }, { icon: '🔗', title: 'Integrations', desc: '100+ tool connections.' }] }, t),
      this._s('s3', 'pricing', { heading: 'Simple Pricing', plans: [{ name: 'Starter', price: '$19/mo', features: ['5 Users', '10GB', 'Email Support'] }, { name: 'Pro', price: '$49/mo', features: ['25 Users', '100GB', 'Priority Support', 'API'], popular: true }, { name: 'Enterprise', price: '$99/mo', features: ['Unlimited', '1TB', '24/7 Support', 'Custom'] }] }, t),
      this._s('s4', 'testimonials', { heading: 'Trusted by Teams', items: [{ name: 'David K.', role: 'CTO', text: 'Cut dev time in half!', avatar: '👨‍💻' }, { name: 'Lisa W.', role: 'Product Lead', text: 'Adopted in one day.', avatar: '👩‍💼' }] }, t),
      this._s('s5', 'cta', { heading: 'Transform Your Workflow', subheading: 'Start free. No credit card required.', cta: 'Get Started Free' }, t),
      this._s('s6', 'footer', { brand: 'SaaS Platform', links: ['Features', 'Pricing', 'Docs', 'Support'] }, t)
    ];
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
    TrialManager.checkEditorAccess();
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
    this.saveSite(); this.renderSite();
    showToast('Section deleted', 'info');
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
    if (!state.currentSite) return;
    const a = state.currentSite.analytics;
    a.visitors = a.visitors || Math.floor(a.views * 0.6);
    const el = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    el('stat-views', a.views.toLocaleString());
    el('stat-visitors', a.visitors.toLocaleString());
    el('stat-clicks', Math.floor(a.views * 0.15).toLocaleString());
    el('stat-time', Math.floor(Math.random() * 120 + 30) + 's');
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

// ══════════════════ PLAN MANAGER ══════════════════
const PlanManager = {
  plans: {
    trial: { pages: 3, versions: 3, components: false, analytics: false, collaboration: false, codeExport: false, formBuilder: 'basic', customDomain: false, presetThemes: 2 },
    starter: { pages: 3, versions: 3, components: false, analytics: false, collaboration: false, codeExport: false, formBuilder: 'basic', customDomain: false, presetThemes: 2 },
    pro: { pages: 10, versions: 10, components: false, analytics: true, collaboration: false, codeExport: false, formBuilder: 'full', customDomain: true, presetThemes: 99 },
    agency: { pages: 999, versions: 999, components: true, analytics: true, collaboration: true, codeExport: true, formBuilder: 'full', customDomain: true, presetThemes: 99 }
  },
  getLimit(key) { return this.plans[state.plan]?.[key] || this.plans.trial[key]; },
  hasFeature(key) { return !!this.plans[state.plan]?.[key]; },
  applyPlanFeatures() {
    const plan = this.plans[state.plan] || this.plans.trial;
    const dl = document.getElementById('btn-download-code');
    if (dl) dl.classList.toggle('hidden', !plan.codeExport);
    const ce = document.getElementById('btn-comment-mode');
    if (ce) ce.classList.toggle('hidden', !plan.collaboration);
  },
  selectPlan(planId) {
    state.plan = planId;
    const user = Store.get('currentUser');
    if (user) { user.plan = planId; Store.set('currentUser', user); }
    showToast(`Upgraded to ${planId}! 🎉`, 'success');
    Modal.close('modal-upgrade');
    this.applyPlanFeatures();
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
    const trial = Auth.checkTrial();
    document.getElementById('trial-days').textContent = trial.days;
    document.getElementById('trial-bar-fill').style.width = ((30 - trial.days) / 30 * 100) + '%';
    if (user.plan !== 'trial') document.getElementById('trial-widget').style.display = 'none';
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
    grid.innerHTML = user.sites.map((s, i) =>
      `<div class="site-card"><div class="site-card-preview">${Renderer.renderSection(Object.values(s.sections)[0] || { type: 'hero', content: { heading: s.name, subheading: '', cta: '' }, styles: { primary: '#6C5CE7', bg: '#0a0a1a', text: '#fff', accent: '#00D2FF' } }, false)}</div>
      <div class="site-card-info"><h4>${s.name}</h4><small>${s.status || 'draft'} · v${s.version || 1}</small>
      <div class="site-card-actions"><button class="btn btn-primary btn-sm" onclick="Editor.loadSite(Store.get('currentUser').sites[${i}]);App.showPage('page-editor')">Edit</button><button class="btn btn-ghost btn-sm" onclick="Dashboard.deleteSite(${i})">Delete</button></div></div></div>`
    ).join('');
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
    const plans = [
      { id: 'starter', name: 'Starter', price: '$9', features: ['3 Pages', 'Basic Editor', 'Free Subdomain', 'SSL', '3 Versions'] },
      { id: 'pro', name: 'Pro', price: '$29', features: ['10 Pages', 'Full Editor', 'Custom Domain', 'Analytics', '10 Versions', 'All Themes'], popular: true },
      { id: 'agency', name: 'Agency', price: '$79', features: ['Unlimited Pages', 'Code Export', 'Collaboration', 'Components', 'Unlimited Versions', 'Custom Domains'] }
    ];
    const html = plans.map(p =>
      `<div class="pricing-card${p.popular ? ' popular' : ''}">${p.popular ? '<div class="popular-badge">Most Popular</div>' : ''}<div class="pricing-name">${p.name}</div><div class="pricing-price">${p.price}<span>/mo</span></div><ul class="pricing-features">${p.features.map(f => `<li>✓ ${f}</li>`).join('')}</ul><button class="btn ${p.popular ? 'btn-primary' : 'btn-outline'} btn-block" onclick="PlanManager.selectPlan('${p.id}')">${state.plan === p.id ? 'Current Plan' : 'Choose Plan'}</button></div>`
    ).join('');
    const up = document.getElementById('upgrade-pricing'); if (up) up.innerHTML = html;
    const dp = document.getElementById('dash-pricing'); if (dp) dp.innerHTML = html;
  },
  showUpgrade() { this.renderPricing(); Modal.open('modal-upgrade'); },
  saveSettings() {
    const user = Store.get('currentUser');
    user.name = document.getElementById('settings-name').value;
    Store.set('currentUser', user);
    showToast('Settings saved!', 'success');
  }
};

// ══════════════════ TRIAL MANAGER ══════════════════
const TrialManager = {
  checkEditorAccess() {
    const trial = Auth.checkTrial();
    const overlay = document.getElementById('editor-trial-overlay');
    if (overlay) overlay.style.display = trial.active ? 'none' : 'flex';
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
      App.showPage('page-onboarding'); Onboard.reset();
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
  if (window.lucide) lucide.createIcons();
});


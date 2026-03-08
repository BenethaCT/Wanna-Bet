const TOKEN_KEY = 'wanna_bet_token_v1';

let token = localStorage.getItem(TOKEN_KEY) || '';
let currentUser = null;

const state = {
  users: [],
  bets: []
};

let authMode = 'login';

const els = {
  authRoot: document.getElementById('authRoot'),
  appRoot: document.getElementById('appRoot'),
  authHeading: document.getElementById('authHeading'),
  authSubtext: document.getElementById('authSubtext'),
  authForm: document.getElementById('authForm'),
  authMsg: document.getElementById('authMsg'),
  authSubmit: document.getElementById('authSubmit'),
  authToggle: document.getElementById('authToggle'),
  authUsername: document.getElementById('authUsername'),
  authPassword: document.getElementById('authPassword'),
  sessionUser: document.getElementById('sessionUser'),
  resetPwdBtn: document.getElementById('resetPwdBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  betForm: document.getElementById('betForm'),
  betTitle: document.getElementById('betTitle'),
  betDetails: document.getElementById('betDetails'),
  betPrize: document.getElementById('betPrize'),
  betOpponent: document.getElementById('betOpponent'),
  liveBets: document.getElementById('liveBets'),
  historyBets: document.getElementById('historyBets'),
  liveCount: document.getElementById('liveCount'),
  historyCount: document.getElementById('historyCount'),
  liveTpl: document.getElementById('liveBetTemplate'),
  historyTpl: document.getElementById('historyBetTemplate')
};

init();

function authHeaders() {
  return token ? { authorization: `Bearer ${token}` } : {};
}

async function apiGet(path) {
  const res = await fetch(path, { headers: { ...authHeaders() } });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function apiPost(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...authHeaders()
    },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function init() {
  els.authForm.addEventListener('submit', onAuthSubmit);
  els.authToggle.addEventListener('click', toggleAuthMode);
  els.resetPwdBtn.addEventListener('click', resetPassword);
  els.logoutBtn.addEventListener('click', logout);
  els.betForm.addEventListener('submit', onCreateBet);

  if (!token) {
    showAuthOnly();
    renderAuth();
    return;
  }

  try {
    const data = await apiGet('/api/state');
    hydrateState(data);
    showApp();
    render();
  } catch {
    logout();
  }
}

function hydrateState(data) {
  currentUser = data.user || null;
  state.users = data.users || [];
  state.bets = data.bets || [];
}

function toggleAuthMode() {
  authMode = authMode === 'login' ? 'register' : 'login';
  els.authMsg.textContent = '';
  renderAuth();
}

function renderAuth() {
  const isLogin = authMode === 'login';
  els.authHeading.textContent = isLogin ? 'Login' : 'Create Account';
  els.authSubtext.textContent = isLogin
    ? 'Use your account to continue.'
    : 'Create a new account to start betting.';
  els.authSubmit.textContent = isLogin ? 'Login' : 'Create Account';
  els.authToggle.textContent = isLogin ? 'Create new account' : 'Already have an account? Login';
}

async function onAuthSubmit(e) {
  e.preventDefault();
  const username = els.authUsername.value.trim();
  const password = els.authPassword.value;

  try {
    const action = authMode === 'login' ? 'login' : 'register';
    const data = await apiPost('/api/auth', { action, username, password });
    token = data.token;
    localStorage.setItem(TOKEN_KEY, token);
    hydrateState(data);
    showApp();
    render();
    els.authForm.reset();
    els.authMsg.textContent = '';
  } catch (err) {
    els.authMsg.textContent = err.message;
  }
}

async function resetPassword() {
  const currentPassword = prompt('Enter current password:');
  if (currentPassword === null) return;
  const newPassword = prompt('Enter new password (8-72 chars):');
  if (newPassword === null) return;
  const confirmPassword = prompt('Confirm new password:');
  if (confirmPassword === null) return;

  if (newPassword !== confirmPassword) {
    alert('Passwords do not match.');
    return;
  }

  try {
    await apiPost('/api/auth', { action: 'reset_password', currentPassword, newPassword });
    alert('Password updated.');
  } catch (err) {
    alert(err.message);
  }
}

async function logout() {
  try {
    if (token) await apiPost('/api/auth', { action: 'logout' });
  } catch {}

  token = '';
  currentUser = null;
  state.users = [];
  state.bets = [];
  localStorage.removeItem(TOKEN_KEY);
  showAuthOnly();
  renderAuth();
}

function showAuthOnly() {
  els.appRoot.classList.add('hidden');
  els.authRoot.classList.remove('hidden');
}

function showApp() {
  els.authRoot.classList.add('hidden');
  els.appRoot.classList.remove('hidden');
}

function fmtDate(iso) {
  return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function isCreator(bet) {
  return currentUser && bet.creatorId === currentUser.id;
}

function isOpponent(bet) {
  return currentUser && bet.opponentId === currentUser.id;
}

function myVote(bet) {
  return (bet.votes || {})[currentUser.id] || null;
}

async function refreshState() {
  const data = await apiGet('/api/state');
  hydrateState(data);
}

async function onCreateBet(e) {
  e.preventDefault();
  const title = els.betTitle.value.trim();
  const details = els.betDetails.value.trim();
  const prize = els.betPrize.value.trim();
  const opponentId = els.betOpponent.value;
  if (!title || !details || !prize || !opponentId) return;

  try {
    const data = await apiPost('/api/bets', { action: 'create', title, details, prize, opponentId });
    hydrateState(data);
    els.betForm.reset();
    render();
  } catch (err) {
    alert(err.message);
  }
}

async function agreeBet(id) {
  try {
    const data = await apiPost('/api/bets', { action: 'agree', id });
    hydrateState(data);
    render();
  } catch (err) {
    alert(err.message);
  }
}

async function editBet(id) {
  const bet = state.bets.find((b) => b.id === id);
  if (!bet || bet.status !== 'pending' || !isCreator(bet)) return;

  const nextTitle = prompt('Edit bet title:', bet.title);
  if (nextTitle === null) return;
  const title = nextTitle.trim();
  if (!title) return;

  const nextDetails = prompt('Edit bet details:', bet.details);
  if (nextDetails === null) return;
  const details = nextDetails.trim();
  if (!details) return;

  const nextPrize = prompt('Edit winner gets?:', bet.prize || '');
  if (nextPrize === null) return;
  const prize = nextPrize.trim();
  if (!prize) return;

  try {
    const data = await apiPost('/api/bets', { action: 'edit', id, title, details, prize });
    hydrateState(data);
    render();
  } catch (err) {
    alert(err.message);
  }
}

async function voteWinner(id, selectedWinnerId) {
  try {
    const data = await apiPost('/api/bets', { action: 'vote', id, selectedWinnerId });
    hydrateState(data);
    render();
  } catch (err) {
    alert(err.message);
  }
}

function mkButton(text, className, handler, disabled = false) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = text;
  if (className) btn.classList.add(className);
  btn.disabled = disabled;
  btn.addEventListener('click', handler);
  return btn;
}

function renderOpponentOptions() {
  els.betOpponent.innerHTML = '';
  const options = state.users.filter((u) => currentUser && u.id !== currentUser.id);

  if (!options.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No other users yet';
    els.betOpponent.appendChild(opt);
    els.betOpponent.disabled = true;
    return;
  }

  els.betOpponent.disabled = false;
  for (const user of options) {
    const opt = document.createElement('option');
    opt.value = user.id;
    opt.textContent = user.username;
    els.betOpponent.appendChild(opt);
  }
}

function render() {
  if (!currentUser) return;

  const live = state.bets.filter((b) => b.status !== 'history');
  const history = state.bets.filter((b) => b.status === 'history');

  els.sessionUser.textContent = `Logged in: ${currentUser.username}`;
  els.liveCount.textContent = `${live.length} live bet${live.length === 1 ? '' : 's'}`;
  els.historyCount.textContent = `${history.length} completed bet${history.length === 1 ? '' : 's'}`;
  renderOpponentOptions();

  els.liveBets.innerHTML = '';
  els.historyBets.innerHTML = '';

  if (!live.length) {
    els.liveBets.appendChild(emptyBlock('No live bets yet.'));
  } else {
    live.forEach((bet) => {
      const node = els.liveTpl.content.firstElementChild.cloneNode(true);
      node.querySelector('.bet-title').textContent = bet.title;
      node.querySelector('.bet-details').textContent = `${bet.details} | Winner gets: ${bet.prize}`;

      const other = isCreator(bet) ? bet.opponent : bet.creator;
      let statusText = 'Waiting for agreement';
      if (bet.status === 'agreed') statusText = 'Awaiting matching votes';
      node.querySelector('.status').textContent = statusText;

      const votes = bet.votes || {};
      const creatorVote = votes[bet.creatorId]?.selectedWinner || 'Not voted';
      const opponentVote = votes[bet.opponentId]?.selectedWinner || 'Not voted';

      let meta = `Creator: ${bet.creator} | Opponent: ${bet.opponent} | Created ${fmtDate(bet.createdAt)}`;
      if (bet.status === 'agreed') meta += ` | Votes -> ${bet.creator}: ${creatorVote}, ${bet.opponent}: ${opponentVote}`;
      node.querySelector('.bet-meta').textContent = meta;

      const actions = node.querySelector('.bet-actions');
      if (bet.status === 'pending') {
        actions.appendChild(mkButton(`Agree (${other})`, 'ok', () => agreeBet(bet.id), !isOpponent(bet)));
        actions.appendChild(mkButton('Edit Bet', 'secondary', () => editBet(bet.id), !isCreator(bet)));
      }

      if (bet.status === 'agreed') {
        actions.appendChild(mkButton(`Vote ${bet.creator}`, 'ok', () => voteWinner(bet.id, bet.creatorId)));
        actions.appendChild(mkButton(`Vote ${bet.opponent}`, 'secondary', () => voteWinner(bet.id, bet.opponentId)));
        const mine = myVote(bet);
        if (mine) {
          const tag = document.createElement('span');
          tag.className = 'pill';
          tag.textContent = `Your vote: ${mine.selectedWinner}`;
          actions.appendChild(tag);
        }
      }

      els.liveBets.appendChild(node);
    });
  }

  if (!history.length) {
    els.historyBets.appendChild(emptyBlock('No completed bets yet.'));
  } else {
    history.forEach((bet) => {
      const node = els.historyTpl.content.firstElementChild.cloneNode(true);
      node.querySelector('.bet-title').textContent = bet.title;
      node.querySelector('.winner').textContent = `Winner: ${bet.winner || '-'}`;
      node.querySelector('.bet-details').textContent = `${bet.details} | Winner gets: ${bet.prize}`;
      node.querySelector('.bet-meta').textContent = `Creator: ${bet.creator} | Opponent: ${bet.opponent} | Completed ${fmtDate(bet.completedAt)}`;
      els.historyBets.appendChild(node);
    });
  }
}

function emptyBlock(message) {
  const el = document.createElement('div');
  el.className = 'empty';
  el.textContent = message;
  return el;
}
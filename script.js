const SESSION_KEY = 'wanna_bet_local_session_v1';
const DB_KEY = 'wanna_bet_local_db_v1';

let currentUser = null;
let authMode = 'login';

const state = {
  users: [],
  bets: []
};

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

function uid() {
  return crypto.randomUUID();
}

async function sha256(text) {
  const enc = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', enc);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function sanitizeText(value, maxLen = 300) {
  return String(value || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function loadDb() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return { users: [], bets: [] };
    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      bets: Array.isArray(parsed.bets) ? parsed.bets : []
    };
  } catch {
    return { users: [], bets: [] };
  }
}

function saveDb() {
  localStorage.setItem(DB_KEY, JSON.stringify({ users: state.users, bets: state.bets }));
}

function applyDb() {
  const db = loadDb();
  state.users = db.users;
  state.bets = db.bets;
}

function getUserById(id) {
  return state.users.find((u) => u.id === id) || null;
}

function userCanSeeBet(userId, bet) {
  return bet.creatorId === userId || bet.opponentId === userId;
}

function getVisibleBets(userId) {
  return state.bets.filter((b) => userCanSeeBet(userId, b));
}

function findUserByName(username) {
  return state.users.find((u) => u.username.toLowerCase() === username.toLowerCase()) || null;
}

async function hashPassword(password, username) {
  return sha256(`wanna-bet-local:${username.toLowerCase()}:${password}`);
}

function toggleAuthMode() {
  authMode = authMode === 'login' ? 'register' : 'login';
  els.authMsg.textContent = '';
  renderAuth();
}

function renderAuth() {
  const isLogin = authMode === 'login';
  els.authHeading.textContent = isLogin ? 'Login' : 'Create Account';
  els.authSubtext.textContent = isLogin ? 'Use your account to continue.' : 'Create a new account to start betting.';
  els.authSubmit.textContent = isLogin ? 'Login' : 'Create Account';
  els.authToggle.textContent = isLogin ? 'Create new account' : 'Already have an account? Login';
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

  const visibleBets = getVisibleBets(currentUser.id);
  const live = visibleBets.filter((b) => b.status !== 'history');
  const history = visibleBets.filter((b) => b.status === 'history');

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
      node.querySelector('.status').textContent = bet.status === 'agreed' ? 'Awaiting matching votes' : 'Waiting for agreement';

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

function mkButton(text, className, handler, disabled = false) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = text;
  if (className) btn.classList.add(className);
  btn.disabled = disabled;
  btn.addEventListener('click', handler);
  return btn;
}

function emptyBlock(message) {
  const el = document.createElement('div');
  el.className = 'empty';
  el.textContent = message;
  return el;
}

async function onAuthSubmit(e) {
  e.preventDefault();
  const username = sanitizeText(els.authUsername.value, 24);
  const password = String(els.authPassword.value || '');

  if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
    els.authMsg.textContent = 'Username must be 3-24 chars: letters, numbers, underscore.';
    return;
  }

  if (password.length < 8 || password.length > 72) {
    els.authMsg.textContent = 'Password must be 8-72 characters.';
    return;
  }

  applyDb();

  if (authMode === 'register') {
    if (findUserByName(username)) {
      els.authMsg.textContent = 'Username already exists.';
      return;
    }

    const user = {
      id: uid(),
      username,
      passHash: await hashPassword(password, username),
      createdAt: new Date().toISOString()
    };
    state.users.push(user);
    saveDb();
    currentUser = { id: user.id, username: user.username };
    localStorage.setItem(SESSION_KEY, currentUser.id);
    showApp();
    render();
    els.authForm.reset();
    els.authMsg.textContent = '';
    return;
  }

  const user = findUserByName(username);
  if (!user) {
    els.authMsg.textContent = 'Invalid credentials.';
    return;
  }

  const candidate = await hashPassword(password, user.username);
  if (candidate !== user.passHash) {
    els.authMsg.textContent = 'Invalid credentials.';
    return;
  }

  currentUser = { id: user.id, username: user.username };
  localStorage.setItem(SESSION_KEY, currentUser.id);
  showApp();
  render();
  els.authForm.reset();
  els.authMsg.textContent = '';
}

function logout() {
  currentUser = null;
  localStorage.removeItem(SESSION_KEY);
  showAuthOnly();
  renderAuth();
}

async function resetPassword() {
  if (!currentUser) return;

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

  if (newPassword.length < 8 || newPassword.length > 72) {
    alert('Password must be 8-72 characters.');
    return;
  }

  applyDb();
  const user = getUserById(currentUser.id);
  if (!user) {
    logout();
    return;
  }

  const currentHash = await hashPassword(currentPassword, user.username);
  if (currentHash !== user.passHash) {
    alert('Current password is incorrect.');
    return;
  }

  user.passHash = await hashPassword(newPassword, user.username);
  saveDb();
  alert('Password updated.');
}

function onCreateBet(e) {
  e.preventDefault();
  if (!currentUser) return;

  const title = sanitizeText(els.betTitle.value, 80);
  const details = sanitizeText(els.betDetails.value, 300);
  const prize = sanitizeText(els.betPrize.value, 120);
  const opponentId = String(els.betOpponent.value || '');

  if (!title || !details || !prize || !opponentId) return;
  if (opponentId === currentUser.id) return;

  applyDb();
  const opponent = getUserById(opponentId);
  if (!opponent) {
    alert('Opponent not found.');
    return;
  }

  state.bets.unshift({
    id: uid(),
    title,
    details,
    prize,
    creatorId: currentUser.id,
    creator: currentUser.username,
    opponentId: opponent.id,
    opponent: opponent.username,
    status: 'pending',
    createdAt: new Date().toISOString(),
    agreedAt: null,
    completedAt: null,
    winnerId: null,
    winner: null,
    votes: {}
  });

  saveDb();
  els.betForm.reset();
  render();
}

function agreeBet(id) {
  if (!currentUser) return;
  applyDb();

  const bet = state.bets.find((b) => b.id === id);
  if (!bet) return;
  if (bet.status !== 'pending') return;
  if (bet.opponentId !== currentUser.id) return;

  bet.status = 'agreed';
  bet.agreedAt = new Date().toISOString();
  bet.votes = {};
  saveDb();
  render();
}

function editBet(id) {
  applyDb();
  const bet = state.bets.find((b) => b.id === id);
  if (!bet || bet.status !== 'pending' || bet.creatorId !== currentUser.id) return;

  const nextTitle = prompt('Edit bet title:', bet.title);
  if (nextTitle === null) return;
  const title = sanitizeText(nextTitle, 80);
  if (!title) return;

  const nextDetails = prompt('Edit bet details:', bet.details);
  if (nextDetails === null) return;
  const details = sanitizeText(nextDetails, 300);
  if (!details) return;

  const nextPrize = prompt('Edit winner gets?:', bet.prize || '');
  if (nextPrize === null) return;
  const prize = sanitizeText(nextPrize, 120);
  if (!prize) return;

  bet.title = title;
  bet.details = details;
  bet.prize = prize;
  saveDb();
  render();
}

function voteWinner(id, selectedWinnerId) {
  if (!currentUser) return;
  applyDb();

  const bet = state.bets.find((b) => b.id === id);
  if (!bet || bet.status !== 'agreed') return;
  if (!userCanSeeBet(currentUser.id, bet)) return;
  if (selectedWinnerId !== bet.creatorId && selectedWinnerId !== bet.opponentId) return;

  const selectedUser = getUserById(selectedWinnerId);
  if (!selectedUser) return;

  bet.votes[currentUser.id] = {
    selectedWinnerId,
    selectedWinner: selectedUser.username,
    votedAt: new Date().toISOString()
  };

  const voteA = bet.votes[bet.creatorId]?.selectedWinnerId;
  const voteB = bet.votes[bet.opponentId]?.selectedWinnerId;
  if (voteA && voteB && voteA === voteB) {
    const winner = getUserById(voteA);
    bet.status = 'history';
    bet.winnerId = voteA;
    bet.winner = winner ? winner.username : null;
    bet.completedAt = new Date().toISOString();
  }

  saveDb();
  render();
}

function hydrateSessionUser() {
  applyDb();
  const uidFromSession = localStorage.getItem(SESSION_KEY);
  if (!uidFromSession) return null;
  const user = getUserById(uidFromSession);
  if (!user) return null;
  return { id: user.id, username: user.username };
}

function init() {
  els.authForm.addEventListener('submit', onAuthSubmit);
  els.authToggle.addEventListener('click', toggleAuthMode);
  els.resetPwdBtn.addEventListener('click', resetPassword);
  els.logoutBtn.addEventListener('click', logout);
  els.betForm.addEventListener('submit', onCreateBet);

  currentUser = hydrateSessionUser();
  renderAuth();

  if (!currentUser) {
    showAuthOnly();
    return;
  }

  showApp();
  render();
}

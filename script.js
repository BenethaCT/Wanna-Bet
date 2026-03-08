const STORAGE_KEY = 'betchaos_v2';
const AUTH_KEY = 'wanna_bet_auth_v2';
const SESSION_KEY = 'wanna_bet_session_v2';
const USERS = ['Ben', 'Sheh'];
const PROFILE_MAP = { Ben: 'ben.PNG', Sheh: 'sheh.PNG' };

let currentUser = null;
let authTargetUser = null;
let authMode = 'login';

const state = {
  bets: loadBets(),
  auth: loadAuth()
};

const els = {
  authRoot: document.getElementById('authRoot'),
  appRoot: document.getElementById('appRoot'),
  profileCards: Array.from(document.querySelectorAll('.profile-card')),
  authPanel: document.getElementById('authPanel'),
  authHeading: document.getElementById('authHeading'),
  authSubtext: document.getElementById('authSubtext'),
  authForm: document.getElementById('authForm'),
  authMsg: document.getElementById('authMsg'),
  authSubmit: document.getElementById('authSubmit'),
  newPwdWrap: document.getElementById('newPwdWrap'),
  confirmPwdWrap: document.getElementById('confirmPwdWrap'),
  loginPwdWrap: document.getElementById('loginPwdWrap'),
  newPwd: document.getElementById('newPwd'),
  confirmPwd: document.getElementById('confirmPwd'),
  loginPwd: document.getElementById('loginPwd'),
  sessionUser: document.getElementById('sessionUser'),
  logoutBtn: document.getElementById('logoutBtn'),
  betForm: document.getElementById('betForm'),
  betTitle: document.getElementById('betTitle'),
  betDetails: document.getElementById('betDetails'),
  betPrize: document.getElementById('betPrize'),
  betCreator: document.getElementById('betCreator'),
  liveBets: document.getElementById('liveBets'),
  historyBets: document.getElementById('historyBets'),
  liveCount: document.getElementById('liveCount'),
  historyCount: document.getElementById('historyCount'),
  benPoints: document.getElementById('benPoints'),
  shehPoints: document.getElementById('shehPoints'),
  liveTpl: document.getElementById('liveBetTemplate'),
  historyTpl: document.getElementById('historyBetTemplate')
};

init();

function init() {
  state.bets = state.bets.map(normalizeBet);
  saveBets();
  saveAuth();

  els.profileCards.forEach((btn) => btn.addEventListener('click', () => openAuth(btn.dataset.user)));
  els.authForm.addEventListener('submit', onAuthSubmit);
  els.logoutBtn.addEventListener('click', logout);
  els.betForm.addEventListener('submit', onCreateBet);

  const session = sessionStorage.getItem(SESSION_KEY);
  if (USERS.includes(session)) {
    loginAs(session);
  } else {
    showAuthOnly();
  }
}

function normalizeName(name) {
  if (name === 'Me') return 'Ben';
  if (name === 'BF') return 'Sheh';
  return name;
}

function cleanText(value) {
  if (!value) return '';
  return String(value).replace(/`r`n/g, ' ').replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function normalizeBet(bet) {
  return {
    ...bet,
    creator: normalizeName(bet.creator),
    winner: normalizeName(bet.winner),
    title: cleanText(bet.title),
    details: cleanText(bet.details),
    prize: cleanText(bet.prize),
    winnerVoteBen: normalizeName(bet.winnerVoteBen) || null,
    winnerVoteSheh: normalizeName(bet.winnerVoteSheh) || null
  };
}

function loadBets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveBets() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.bets));
}

function loadAuth() {
  const defaults = { Ben: { passHash: null }, Sheh: { passHash: null } };
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    const parsed = raw ? JSON.parse(raw) : defaults;
    USERS.forEach((u) => {
      if (!parsed[u]) parsed[u] = { passHash: null };
      if (typeof parsed[u].passHash !== 'string') parsed[u].passHash = null;
    });
    return parsed;
  } catch {
    return defaults;
  }
}

function saveAuth() {
  localStorage.setItem(AUTH_KEY, JSON.stringify(state.auth));
}

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return `h${h}`;
}

function openAuth(user) {
  authTargetUser = user;
  els.authPanel.classList.remove('hidden');
  els.authMsg.textContent = '';
  els.newPwd.value = '';
  els.confirmPwd.value = '';
  els.loginPwd.value = '';

  if (!state.auth[user].passHash) {
    authMode = 'setup';
    els.authHeading.textContent = `Set Password for ${user}`;
    els.authSubtext.textContent = 'First login: create your password.';
    els.newPwdWrap.classList.remove('hidden');
    els.confirmPwdWrap.classList.remove('hidden');
    els.loginPwdWrap.classList.add('hidden');
    els.authSubmit.textContent = 'Set Password';
  } else {
    authMode = 'login';
    els.authHeading.textContent = `Enter Password for ${user}`;
    els.authSubtext.textContent = 'Login to continue.';
    els.newPwdWrap.classList.add('hidden');
    els.confirmPwdWrap.classList.add('hidden');
    els.loginPwdWrap.classList.remove('hidden');
    els.authSubmit.textContent = 'Login';
  }
}

function onAuthSubmit(e) {
  e.preventDefault();
  if (!authTargetUser) return;

  if (authMode === 'setup') {
    const pw1 = els.newPwd.value;
    const pw2 = els.confirmPwd.value;
    if (pw1.length < 4) {
      els.authMsg.textContent = 'Password must be at least 4 characters.';
      return;
    }
    if (pw1 !== pw2) {
      els.authMsg.textContent = 'Passwords do not match.';
      return;
    }
    state.auth[authTargetUser].passHash = simpleHash(pw1);
    saveAuth();
    loginAs(authTargetUser);
    return;
  }

  const pw = els.loginPwd.value;
  if (simpleHash(pw) !== state.auth[authTargetUser].passHash) {
    els.authMsg.textContent = 'Wrong password.';
    return;
  }
  loginAs(authTargetUser);
}

function loginAs(user) {
  currentUser = user;
  sessionStorage.setItem(SESSION_KEY, user);
  els.sessionUser.textContent = `Logged in: ${user}`;
  els.betCreator.value = user;
  showApp();
  render();
}

function logout() {
  currentUser = null;
  sessionStorage.removeItem(SESSION_KEY);
  showAuthOnly();
}

function showAuthOnly() {
  els.appRoot.classList.add('hidden');
  els.authRoot.classList.remove('hidden');
  els.authPanel.classList.add('hidden');
}

function showApp() {
  els.authRoot.classList.add('hidden');
  els.appRoot.classList.remove('hidden');
}

function uid() {
  return `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function fmtDate(iso) {
  return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function otherPerson(person) {
  return person === 'Ben' ? 'Sheh' : 'Ben';
}

function onCreateBet(e) {
  e.preventDefault();
  if (!currentUser) return;

  const title = els.betTitle.value.trim();
  const details = els.betDetails.value.trim();
  const prize = els.betPrize.value.trim();
  const creator = normalizeName(els.betCreator.value);

  if (!title || !details || !prize || !creator) return;

  state.bets.unshift({
    id: uid(),
    title,
    details,
    prize,
    creator,
    status: 'pending',
    createdAt: new Date().toISOString(),
    agreedAt: null,
    completedAt: null,
    winner: null,
    winnerVoteBen: null,
    winnerVoteSheh: null
  });

  saveBets();
  els.betForm.reset();
  els.betCreator.value = currentUser;
  render();
}

function agreeBet(id) {
  if (!currentUser) return;
  const bet = state.bets.find((b) => b.id === id);
  if (!bet || bet.status !== 'pending') return;
  if (currentUser !== otherPerson(bet.creator)) return;

  bet.status = 'agreed';
  bet.agreedAt = new Date().toISOString();
  bet.winnerVoteBen = null;
  bet.winnerVoteSheh = null;
  saveBets();
  render();
}

function editBet(id) {
  const bet = state.bets.find((b) => b.id === id);
  if (!bet || bet.status !== 'pending') return;

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

  bet.title = title;
  bet.details = details;
  bet.prize = prize;
  saveBets();
  render();
}

function voteWinner(id, selectedWinner) {
  if (!currentUser) return;
  const bet = state.bets.find((b) => b.id === id);
  if (!bet || bet.status !== 'agreed') return;

  if (currentUser === 'Ben') bet.winnerVoteBen = selectedWinner;
  if (currentUser === 'Sheh') bet.winnerVoteSheh = selectedWinner;

  if (bet.winnerVoteBen && bet.winnerVoteSheh && bet.winnerVoteBen === bet.winnerVoteSheh) {
    bet.status = 'history';
    bet.winner = bet.winnerVoteBen;
    bet.completedAt = new Date().toISOString();
  }

  saveBets();
  render();
}

function updatePoints(history) {
  let ben = 0;
  let sheh = 0;
  history.forEach((bet) => {
    if (normalizeName(bet.winner) === 'Ben') ben += 1;
    if (normalizeName(bet.winner) === 'Sheh') sheh += 1;
  });
  els.benPoints.textContent = String(ben);
  els.shehPoints.textContent = String(sheh);
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

function render() {
  if (!currentUser) return;

  const live = state.bets.filter((b) => b.status !== 'history');
  const history = state.bets.filter((b) => b.status === 'history');

  els.sessionUser.textContent = `Logged in: ${currentUser}`;
  if (!els.betCreator.value) els.betCreator.value = currentUser;

  els.liveCount.textContent = `${live.length} live bet${live.length === 1 ? '' : 's'}`;
  els.historyCount.textContent = `${history.length} completed bet${history.length === 1 ? '' : 's'}`;
  updatePoints(history);

  els.liveBets.innerHTML = '';
  els.historyBets.innerHTML = '';

  if (!live.length) {
    els.liveBets.appendChild(emptyBlock('No live bets. Peace is suspicious.'));
  } else {
    live.forEach((bet) => {
      const node = els.liveTpl.content.firstElementChild.cloneNode(true);
      node.querySelector('.bet-title').textContent = bet.title;
      node.querySelector('.bet-details').textContent = `${bet.details} | Winner gets: ${bet.prize || 'Not set'}`;

      let statusText = 'Waiting for agreement';
      if (bet.status === 'agreed') {
        statusText = `Awaiting matching votes`;
      }
      node.querySelector('.status').textContent = statusText;

      let meta = `Started by ${bet.creator} on ${fmtDate(bet.createdAt)}`;
      if (bet.status === 'agreed') {
        meta += ` | Ben vote: ${bet.winnerVoteBen || 'Not voted'} | Sheh vote: ${bet.winnerVoteSheh || 'Not voted'}`;
      }
      node.querySelector('.bet-meta').textContent = meta;

      const proposerAvatar = node.querySelector('.proposer-avatar');
      proposerAvatar.src = PROFILE_MAP[bet.creator] || '';
      proposerAvatar.alt = `${bet.creator} profile`;

      const actions = node.querySelector('.bet-actions');
      if (bet.status === 'pending') {
        const canAgree = currentUser === otherPerson(bet.creator);
        actions.appendChild(mkButton(`Agree (${otherPerson(bet.creator)})`, 'ok', () => agreeBet(bet.id), !canAgree));
        actions.appendChild(mkButton('Edit Bet', 'secondary', () => editBet(bet.id)));
      }

      if (bet.status === 'agreed') {
        const myVote = currentUser === 'Ben' ? bet.winnerVoteBen : bet.winnerVoteSheh;
        actions.appendChild(mkButton(`${currentUser} votes: Ben`, 'ok', () => voteWinner(bet.id, 'Ben')));
        actions.appendChild(mkButton(`${currentUser} votes: Sheh`, 'secondary', () => voteWinner(bet.id, 'Sheh')));
        if (myVote) {
          const tag = document.createElement('span');
          tag.className = 'pill';
          tag.textContent = `Your vote: ${myVote}`;
          actions.appendChild(tag);
        }
      }

      els.liveBets.appendChild(node);
    });
  }

  if (!history.length) {
    els.historyBets.appendChild(emptyBlock('No completed bets yet. Crown awaits.'));
  } else {
    history.forEach((bet) => {
      const node = els.historyTpl.content.firstElementChild.cloneNode(true);
      node.querySelector('.bet-title').textContent = bet.title;
      node.querySelector('.winner').textContent = `Winner: ${bet.winner}`;
      const winnerAvatar = node.querySelector('.winner-avatar');
      winnerAvatar.src = PROFILE_MAP[bet.winner] || '';
      winnerAvatar.alt = `${bet.winner} profile`;
      node.querySelector('.bet-details').textContent = `${bet.details} | Winner gets: ${bet.prize || 'Not set'}`;
      node.querySelector('.bet-meta').textContent = `Proposed by ${bet.creator} | Completed ${fmtDate(bet.completedAt)}`;
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


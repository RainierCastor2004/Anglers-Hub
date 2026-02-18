// Simple client-side auth and navigation helper (localStorage)
(function(){
  function $(id){return document.getElementById(id)}

  function getUsers(){
    try{ return JSON.parse(localStorage.getItem('users')||'[]') }catch(e){return[]}
  }
  function saveUsers(u){ localStorage.setItem('users', JSON.stringify(u)) }

  // store current user either in localStorage (remember) or sessionStorage (not remembered)
  function setCurrent(user, remember=true){
    if(remember) localStorage.setItem('currentUser', JSON.stringify(user));
    else sessionStorage.setItem('currentUser', JSON.stringify(user));
  }
  function getCurrent(){
    try{
      return JSON.parse(localStorage.getItem('currentUser')) || JSON.parse(sessionStorage.getItem('currentUser')) || null
    }catch(e){return null}
  }
  function clearCurrent(){ localStorage.removeItem('currentUser'); sessionStorage.removeItem('currentUser') }

  function redirectToHome(){ window.location.href='home.html' }

  // basic SHA-256 hash helper
  function buf2hex(buffer){ return Array.from(new Uint8Array(buffer)).map(b=>b.toString(16).padStart(2,'0')).join('') }
  async function hashStr(str){
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
    return buf2hex(buf);
  }

  // Index page (login/signup)
  document.addEventListener('DOMContentLoaded', ()=>{
    const loginForm = $('loginForm');
    const signupForm = $('signupForm');
    const showLogin = $('showLogin');
    const showSignup = $('showSignup');

    if(showLogin && showSignup){
      showLogin.addEventListener('click', ()=>{ showLogin.classList.add('active'); showSignup.classList.remove('active'); loginForm.classList.remove('hidden'); signupForm.classList.add('hidden') })
      showSignup.addEventListener('click', ()=>{ showSignup.classList.add('active'); showLogin.classList.remove('active'); signupForm.classList.remove('hidden'); loginForm.classList.add('hidden') })
    }

    if(loginForm){
      loginForm.addEventListener('submit', async e=>{
        e.preventDefault();
        const email = $('loginEmail').value.trim();
        const pass = $('loginPassword').value;
        const remember = !!$('rememberMe') && $('rememberMe').checked;
        const passHash = await hashStr(pass);
        const user = getUsers().find(u=>u.email===email && u.passwordHash===passHash);
        if(user){ setCurrent({name:user.name,email:user.email}, remember); redirectToHome(); }
        else alert('Invalid credentials or account not found.');
      })
    }

    if(signupForm){
      signupForm.addEventListener('submit', async e=>{
        e.preventDefault();
        const name = $('signupName').value.trim();
        const email = $('signupEmail').value.trim();
        const pass = $('signupPassword').value;
        const users = getUsers();
        if(users.find(u=>u.email===email)){ alert('Account already exists with that email.'); return }
        const passHash = await hashStr(pass);
        users.push({name:name,email:email,passwordHash:passHash});
        saveUsers(users);
        // on signup we remember by default
        setCurrent({name:name,email:email}, true);
        redirectToHome();
      })
    }

    // Protected pages: show user info and wire logout
    const current = getCurrent();
    if(current){
      const userNameDisplay = $('userNameDisplay'); if(userNameDisplay) userNameDisplay.textContent = current.name || current.email;
      const profileName = $('profileName'); if(profileName) profileName.textContent = current.name || '';
      const profileEmail = $('profileEmail'); if(profileEmail) profileEmail.textContent = current.email || '';
    }

    // If we are on a page other than index.html, ensure logged in
    const pathname = window.location.pathname || window.location.href;
    const isIndex = pathname.endsWith('index.html') || pathname.endsWith('/');
    if(!isIndex && !getCurrent()){ window.location.href='index.html' }

    // Logout buttons
    const logoutBtn = $('logout');
    if(logoutBtn){ logoutBtn.addEventListener('click', ()=>{ clearCurrent(); window.location.href='index.html' }) }
  })
})();